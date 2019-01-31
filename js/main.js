/* -------------------- ESTADO COMPARTIDO -------------------- */
const state = new Vue({
    data: {
        myUser: {},
        users: [],
        player: null,
        entry: false
    }
});
/* -------------------- COMPONENTE PRINCIPAL -------------------- */
const Home = {
    name: 'home',
    template: '#home-template',
    data() {
        return {
            nick: ''
        }
    },
    methods: {
        // Agregar el usuario del jugador actual
        addMyUser() {
            if (!this.userExists && this.nick.length) {
                state.entry = true;
                this.$socket.emit('adduser', this.nick);
            }
        },
        // Enviar un reto a otro jugador
        challenge(id) {
            this.$socket.emit('challenge', id);
            this.$socket.emit('changestate');
            swal.fire({
                type: 'info',
                title: 'Esperando respuesta',
                showConfirmButton: false,
                allowOutsideClick: false,
                allowEscapeKey: false,
                allowEnterKey: false,
                onBeforeOpen: () => {
                    swal.showLoading();
                }
            });
        }
    },
    computed: {
        // Habilitar/deshabilitar botón de ingreso de nick
        disabledButton() {
            return this.nick.length < 3 || this.userExists;
        },
        // Texto a mostrar en el mismo botón
        textButton() {
            return this.userExists ? 'Existente': 'Ir';
        },
        // Comprobar la existencia del nick escrito
        userExists() {
            const index = state.users.findIndex(user => user.nick === this.nick);
            return index !== -1;
        }
    }
};
/* -------------------- COMPONENTE ZONA DE JUEGO -------------------- */
const Play = {
    name: 'play',
    template: '#play-template',
    data() {
        return {
            // Número de turnos dados
            turn: 0,
            // Nick del jugador con el turno actual
            playerTurn: null,
            // Saber si alguien ha ganado
            winner: false,
            // Comprobar qué jugador ha dado click
            auto: false,
            // Almacenar las posiciones en que cada jugador ha dado click
            arrTriqui: new Array(9),
            // Celdas del cuadro de juego
            cells: document.getElementsByClassName('div-td'),
            // Ícono a imprimir del jugador actual
            print: {
                icon: '<i class="material-icons red-text fs-2">close</i>',
                letter: 'X'
            },
            // Ícono a imprimir del rival
            rivalPrint: {
                icon: '<i class="material-icons blue-text fs-2">panorama_fish_eye</i>',
                letter: 'O'
            }
        }
    },
    sockets: {
        // Click en automático del rival
        nextturn(index) {
            this.auto = true;
            this.cells[index].click();
        }
    },
    created() {
        this.arrTriqui.fill('-');
        // Asignar el primero turno al jugador que ha enviado el reto
        this.playerTurn = this.p1;
        // Cambiar ícono a imprimir de acuerdo a si es el jugador 1 o el 2
        if (this.p1 !== state.myUser.nick) {
            this.print = {
                icon: '<i class="material-icons blue-text fs-2">panorama_fish_eye</i>',
                letter: 'O'
            }
            this.rivalPrint = {
                icon: '<i class="material-icons red-text fs-2">close</i>',
                letter: 'X'
            }
        }
    },
    methods: {
        // Mostrarle a los jugadores de quién es el turno actual
        currentShift(player) {
            return this.playerTurn === player ? 'turn' : '';
        },
        // Verificar si un jugador ha ganado
        isWinner(player) {
            // Combinaciones ganadoras
            const combs = [
                [0, 1, 2],
                [3, 4, 5],
                [6, 7, 8],
                [0, 3, 6],
                [1, 4, 7],
                [2, 5, 8],
                [0, 4, 8],
                [2, 4, 6]
            ];
            return combs.some(comb => {
                return comb.every(el => this.arrTriqui[el] === player);
            });
        },
        // Mostrar una alerta de acuerdo a una acción en específico
        showAlert({ type, title, text, btnColor }) {
            return swalM.fire({
                type,
                title,
                text,
                confirmButtonText: 'Volver',
                confirmButtonClass: `btn ${btnColor} waves-effect waves-light`
            }).then( () => {
                this.$socket.emit('changestate');
                this.$router.push({ name: 'home' });
                state.player = null;
            });
        },
        // Lógica del juego
        getTarget(target) {
            // Índice del cuadro en el cual el jugador ha dado click
            const index = this.getIndex(target);
            // Click manual
            if (!this.auto) {
                // Verificar turno del jugador y contenido de la celda a dar click
                if (this.playerTurn === state.myUser.nick && !target.textContent.length) {
                    // Emitirle al rival la acción
                    this.$socket.emit('nextturn', { id: state.player.id, index });
                    this.turn++;
                    // Imprimir en la celda
                    target.innerHTML = this.print.icon;
                    // Guardar lo que ha impreso y quién
                    this.arrTriqui[index] = this.print.letter;
                    // Verificar si un jugador ha ganado pero del turno 5 en adelante
                    if (this.turn >= 5) {
                        this.winner = this.isWinner(this.print.letter);
                    }
                    // Acción a ejecutar de acuerdo a si alguien a ganado o no
                    switch (this.winner) {
                        case true:
                            const config = {
                                type: 'success',
                                title: `¡Has ganado!`,
                                text: `¡Grandioso ${state.myUser.nick}! :)`,
                                btnColor: 'green'
                            };
                            this.showAlert(config);
                        break;
                        case false:
                            if (this.turn === 9) {
                                const config = {
                                    type: 'info',
                                    title: `¡Partida empatada!`,
                                    text: `¡Por lo menos no se perdió! :)`,
                                    btnColor: 'indigo'
                                };
                                this.showAlert(config);
                                break;
                            }
                            this.playerTurn = state.player.nick;
                        break;
                    }
                }
            } else {
                // Click automático
                this.turn++;
                target.innerHTML = this.rivalPrint.icon;
                this.arrTriqui[index] = this.rivalPrint.letter;
                this.auto = false;

                if (this.turn >= 5) {
                    this.winner = this.isWinner(this.rivalPrint.letter);
                }

                switch (this.winner) {
                    case true:
                    const config = {
                        type: 'error',
                        title: `¡Has perdido!`,
                        text: `¡${state.player.nick} ha sido el ganador!`,
                        btnColor: 'red'
                    };
                    this.showAlert(config);
                    break;
                    case false:
                        if (this.turn === 9) {
                            const config = {
                                type: 'info',
                                title: `¡Partida empatada!`,
                                text: `¡Por lo menos no se perdió! :)`,
                                btnColor: 'indigo'
                            };
                            this.showAlert(config);
                            break;
                        }
                        this.playerTurn = state.myUser.nick;
                    break;
                }
            }
        },
        // Obtener el índice de la celda
        getIndex(target) {
            for (let index in this.cells) {
                if (this.cells[index] === target) {
                    return index;
                }
            }
        }
    },
    components: {
        // Tabla zona de juego
        tableTriqui: {
            template: `
                <div class="div-table">
                    <div class="div-tr" v-for="tr in 3">
                        <div class="div-td" v-for="td in 3" @click="target($event)"></div>
                    </div>
                </div>
            `,
            methods: {
                // Emitirle al componente padre dónde se ha dado click
                target({ target }) {
                    this.$emit('target', target);
                }
            }
        }
    },
    // nicks de los jugadores en partida
    props: ['p1','p2']
};
/* -------------------- GLOBALES -------------------- */
// Mostrar una alerta
function showToast() {
    return swal.fire({
        type: 'success',
        title: '¡Partida iniciada!',
        showConfirmButton: false,
        position: 'bottom-right',
        timer: 2500,
        toast: true,
    });
};
// Objeto SweetAlert personalizado
const swalM = Swal.mixin({
    confirmButtonClass: 'btn green waves-effects waves-light m-sides-0-5',
    cancelButtonClass: 'btn red waves-effects waves-light m-sides-0-5',
    buttonsStyling: false
});
// Filtro mayúsculas
Vue.filter('toUpper', value => value.toUpperCase());
// Barra superior
Vue.component('navbar', {
    template: '#navbar-template'
});
// Receptor de eventos Socket.IO
Vue.component('socketListener', {
    // Eventos recibidos desde la API
    sockets: {
        usersonline(users) {
            state.users = users;
        },
        addmyuser(myUser) {
            state.myUser = myUser;
            this.nick = '';
        },
        adduser(user) {
            state.users.push(user);
        },
        changestate(id) {
            const index = state.users.findIndex(user => user.id === id);
            if (index !== -1) {
                state.users[index].play = !state.users[index].play;
            }
        },
        challangeresponse({ res, player }) {
            swal.close();
            if (!res) {
                this.$socket.emit('changestate');
                return swalM.fire({
                    type: 'error',
                    title: `¡${player.nick} ha rechazado tu reto!`,
                    showConfirmButton: false,
                    showCancelButton: true,
                    cancelButtonText: 'Ok'
                });
            }

            showToast();
            state.player = player;
            this.$router.push({
                name: 'play',
                params: { p1: state.myUser.nick, p2: player.nick }
            });
        },
        challenge(player) {
            this.$socket.emit('changestate');
            swalM.fire({
                type: 'question',
                title: `¡Reto entrante de ${player.nick}!`,
                text: '¿Aceptas?',
                showCancelButton: true,
                cancelButtonText: 'No',
                confirmButtonText: 'Ok',
                allowOutsideClick: false,
                allowEscapeKey: false
            }).then(res => {
                this.$socket.emit('challangeresponse', { res: res.value, id: player.id });
                if (res.value) {
                    showToast();
                    state.player = player;
                    this.$router.push({
                        name: 'play',
                        params: { p1: player.nick, p2: state.myUser.nick }
                    });
                } else {
                    this.$socket.emit('changestate');
                }
            });
        },
        leftuser(id) {
            const index = state.users.findIndex(user => user.id === id);
            if (index !== -1) {
                state.users.splice(index, 1);
            }
        }
    }
});
// Enrrutador de Vuejs
const router = new VueRouter({
    mode: 'history',
    routes: [
        {
            path: '/',
            name: 'home',
            component: Home
        },
        {
            path: '/play/:p1-vs-:p2',
            props: true,
            name: 'play',
            component: Play
        }
    ]
});
// Conexión a Socket.IO
const socket = new VueSocketIO({
    debug: false,
    connection: 'http://127.0.0.1:3000'
});

Vue.use(socket);

new Vue({
    el: '#app',
    router
});