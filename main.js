function update_piece_counts(bughouse_counts) {  
    for (let i=0; i<4; i++) {
        let our_str = "<td>0</td>";

        for (let j=0; j<5; j++) {
            our_str += `<td>${bughouse_counts[i][j]}</td>`;
        }

        window.counts[i].innerHTML = our_str;
    }
}

function update_chess_clock() {
    const temp_time = (new Date().getTime());

    if (window.clock_times[0] != null) {
        const delta = temp_time - window.clock_times[0];
        window.clock_times[0] = temp_time;
        window.clocks[0] -= delta/1000;
    }

    if (window.clock_times[1] != null) {
        const delta = temp_time - window.clock_times[1];
        window.clock_times[1] = temp_time;
        window.clocks[1] -= delta/1000;
    }

    if (window.clocks[1] <= 0) {
        we_won_the_game();
        return;
    }

    window.time_mine.innerText = `${Math.floor(window.clocks[0]/60)}:${(window.clocks[0]%60).toFixed(1)}`;
    window.time_theirs.innerText = `${Math.floor(window.clocks[1]/60)}:${(window.clocks[1]%60).toFixed(1)}`;
}

function create_screen() {
    document.getElementById('create_screen').style = 'display:block';
    document.getElementById('play_screen').style = 'display:none';
    document.getElementById('token_screen').style = 'display:none'; 
}

function play_screen() {
    document.getElementById('play_screen').style = 'display:block';
    document.getElementById('create_screen').style = 'display:none'; 
    document.getElementById('token_screen').style = 'display:none';        
}

function token_screen(token) {
    const token_dom = document.getElementById('connection_token');

    token_dom.innerText = json_to_b64(token);

    document.getElementById('play_screen').style = 'display:none';
    document.getElementById('create_screen').style = 'display:none';     
    document.getElementById('token_screen').style = 'display:block';   
}

function copy_token(dom_id) {
    if (!dom_id) {
        dom_id = 'connection_token';
    }

    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($(`#${dom_id}`).text()).select();
    document.execCommand("copy");
    $temp.remove();
}

function handle_message_host(data, message_player) {
    if (typeof data != "string") {
        data = String.fromCharCode.apply(null, data);
    }

    if (data.startsWith('MOVE')) {
        console.log(`[host] got move ${data} from player ${message_player}`);
        const params = data.split('_');
        // MOVE_${window.player}_${source}_${target}_${piece}

        const source = params[2];
        const target = params[3];
        const piece = params[4];

        window.game.doMove(message_player, source, target, piece);
        update_piece_counts(window.game.getBugs());


        if (message_player == 3 - window.player) {
            // Was opponents move, start my chess clock and stop my opponents
            window.clock_times[0] = new Date().getTime();
            window.clock_times[1] = null;
            window.clocks[1] += window.inc_param;
        }

        // Replicate (but not to the source)
        for (let i=0; i<4; i++) {
            if (i == message_player || i == window.player) continue;
            window.host_peers[i].send(data);
        }

        // update board
        if (message_player == 3 - window.player) {
            window.my_board.move(`${source}-${target}`);
        } else {
            window.their_board.move(`${source}-${target}`);
        }
    } else if (data.startsWith('GAMEOVER')) {
        const msg = data.substring(9);

        // Replicate (but not to the source)
        for (let i=0; i<4; i++) {
            if (i == message_player || i == window.player) continue;
            window.host_peers[i].send(data);
        }

        clearInterval(window.chessInterval);
        alert(`Game over!\n${msg}`);
        start_game();
    } else {
        console.log(`[host] host data: ${data}`);
    }
}

function handle_message_player(data) {
    if (typeof data != "string") {
        data = String.fromCharCode.apply(null, data);
    }

    if (data.startsWith('ALLCONNECTED')) {
        const params = data.split('_');

        window.player = parseInt(params[1]);
        window.pool_param = parseFloat(params[2]);
        window.inc_param  = parseFloat(params[3]);

        console.log(`[player] connected as player ${window.player}`);

        start_game();
    } else if (data.startsWith('MOVE')) {
        
        const params = data.split('_');
        // MOVE_${window.player}_${source}_${target}_${piece}

        const move_player = parseInt(params[1]);
        const source = params[2];
        const target = params[3];
        const piece = params[4];

        console.log(`[player] got move ${data} from player ${move_player}`);

        window.game.doMove(move_player, source, target, piece);
        update_piece_counts(window.game.getBugs());

        if (move_player == 3 - window.player) {
            // Was opponents move, start my chess clock and stop my opponents
            window.clock_times[0] = new Date().getTime();
            window.clock_times[1] = null;
            window.clocks[1] += window.inc_param;
        }

        // update board        
        if (move_player == 3 - window.player) {
            window.my_board.move(`${source}-${target}`);
        } else {
            window.their_board.move(`${source}-${target}`);
        }
    } else if (data.startsWith('GAMEOVER')) {
        const msg = data.substring(9);

        clearInterval(window.chessInterval);
        alert(`Game over!\n${msg}`);
        start_game();
    } else {
        console.log(`[player] player data: ${data}`);
    }
}

function host_broadcast(data) {
    for (let i=0; i<4; i++) {
        if (i == window.player) continue;
        console.log(`[host] broadcasting to ${i} data ${data}`)
        window.host_peers[i].send(data);
    }
}

function we_won_the_game() {
    // Game is over, we won!
    const victory_message = prompt('You won! Type your victory message below.');
    if (is_host()) {
        host_broadcast(`GAMEOVER_${victory_message}`);
    } else {
        window.player_peer.send(`GAMEOVER_${victory_message}`);
    }

    clearInterval(window.chessInterval);
    start_game();        
}

function start_game() {
    if (isNaN(window.player) || isNaN(window.pool_param) || isNaN(window.inc_param)) {
        alert("Invalid params.");
        window.location = "/";
    }

    window.game = new Bughouse();
    window.clocks = [window.pool_param, window.pool_param] // ours, theirs
    window.clock_times = [null, null] // last time for timing
    window.clock_interval = setInterval(update_chess_clock, 40);

    window.my_board = Chessboard('my_board', {
        dropOffBoard: 'snapback',
        sparePieces: true,
        pieceTheme:'img/{piece}.png',
        orientation: (window.player % 2 == 0) ? 'white' : 'black',
        onDragStart: function(source, piece, position, orientation) {

            // Can't move if not ur color
            if ((piece.startsWith('w') && orientation == 'black') || 
                (piece.startsWith('b') && orientation == 'white')) {
                return false;
            }

            if (source == 'spare') {
                const bughouse_counts = game.getBugs()[window.player];
                
                const ordering  = ['Q', 'R', 'B', 'N', 'P']
                const count = bughouse_counts[ordering.indexOf(piece.charAt(1))];

                if (count == 0) return false;
            }
        },
        onDrop: function(source, target, piece, newPos, oldPos, orientation) {
            console.log('move', window.player, source, target, piece);

            const is_valid = window.game.doMove(window.player, source, target, piece);
            
            if (!is_valid) return 'snapback';

            if (window.game.isOver()) {
                we_won_the_game();
                return;
            }

            window.clocks[0] += window.inc_param;
            update_piece_counts(window.game.getBugs());
            
            // Stop my chess clock and start my opponents
            window.clock_times[1] = new Date().getTime();
            window.clock_times[0] = null;

            const move_msg = `MOVE_${window.player}_${source}_${target}_${piece}`;

            if (is_host()) {
                host_broadcast(move_msg);
            } else {
                window.player_peer.send(move_msg)
            }
        }
    });

    window.their_board = Chessboard('their_board', {
        pieceTheme:'img/{piece}.png'
    });

    window.my_board.start();
    window.their_board.start();

    window.counts = [null, null, null, null];

    window.counts[window.player] = document.getElementById('my_piece_counts');
    window.counts[3-window.player] = document.getElementById('their_piece_counts');

    for (let i=0; i<4; i++) {
        if (window.counts[i] != null) continue;

        if (i%2 == 0) window.counts[i] = document.getElementById('other_board_white_counts');
        else window.counts[i] = document.getElementById('other_board_black_counts');
    }
    
    window.time_mine = document.getElementById('my_time');
    window.time_theirs = document.getElementById('their_time');

    update_piece_counts(window.game.getBugs());

    play_screen();
}

// Create a game as host and set up connection edges with handlers.
function create_game() {
    window.pool_param = parseFloat(document.getElementById('pool_input').value)*60;
    window.inc_param = parseFloat(document.getElementById('inc_input').value);
    window.player = parseInt(document.getElementById('player_input').value);

    // start_game();
    // return;

    if (isNaN(window.pool_param) || isNaN(window.inc_param)) {
        alert('Invalid pool or inc');
    } else {
        window.host_peers = [null,null,null,null];
        window.connected = [false, false, false, false];
        window.connected[window.player] = true;
        window.signals = [null, null, null, null];

        for (let i=0; i<4; i++) {
            if (i == window.player) continue;

            window.host_peers[i] = new SimplePeer({
                initiator:true,
                trickle:false
            });

            window.host_peers[i].on('data', data => handle_message_host(data, i));

            window.host_peers[i].on('connect', _ => {
                console.log(`[host] player ${i} connected to host!`);
                
                if (window.connected[i]) {
                    alert(`Multiple users as player ${i}, aborting!`);
                    return;
                }
        
                window.connected[i] = true;
                if (window.connected.every(v => v === true)) {
                    // All connected, time to launch the game!!!
                    for (let j=0; j<4; j++) {
                        if (window.player == j) continue;
                        window.host_peers[j].send(
                            `ALLCONNECTED_${j}_${window.pool_param}_${window.inc_param}`
                        );
                    }

                    start_game();
                }
            });

            window.host_peers[i].on('error', err => console.log(`[host] error player ${i}`, err));

            window.host_peers[i].on('signal', data => {
                const json_b64 = json_to_b64(data);
                window.signals[i] = json_b64;

                let all_set = true;
                for (let j=0; j<4; j++) {
                    if (j == window.player) continue;

                    if (window.signals[j] == null) all_set = false;
                }

                if (all_set) {
                    document.getElementById('create_0').style = "display:none";
                    document.getElementById('create_1').style = "display:block";

                    const dom = document.getElementById('create_1').children[1];

                    let dom_text = ""
                    for (let j=0; j<4; j++) {
                        if (j == window.player) continue;

                        const color = j%2 == 0 ? "White" : "Black";
                        const team = j < 2 ? 1 : 2;

                        const url = window.location.href + "#" + encodeURIComponent(window.signals[j]);

                        dom_text += `<h3>${color} team ${team}</h3>`;
                        dom_text += `<p><a href="${url}" target="_blank">Join link</a> `;
                        dom_text += `<button onclick="copy_token('clipboard_hidden_${j}')">Copy to clipboard</button></p>`;
                        dom_text += `<span id="clipboard_hidden_${j}" style="display:none">${url}</span>`;
                        dom_text += `<p>Token: <input id="token_${j}" /></p>`;
                        dom_text += `<br />`;
                    }

                    dom.innerHTML = dom_text;
                }               
            });
        }
    }
}

// Connect host to players and wait for confirmation.
function start_host() {
    for (let i=0; i<4; i++) {
        if (i == window.player) continue;
        const token = document.getElementById(`token_${i}`).value;
        window.host_peers[i].signal(b64_to_json(token));
    }

    document.getElementById('create_1').style = "display:none";
    document.getElementById('create_2').style = "display:block";
}

function start_app() {
    if (window.location.hash.length == 0) {
        create_screen();
        return;
    }

    const token = b64_to_json(decodeURIComponent(window.location.hash.substring(1)));

    window.player_peer = new SimplePeer({
        initiator:false,
        trickle:false
    });

    window.player_peer.on('error', err => console.log('error', err));

    window.player_peer.on('data', handle_message_player);

    window.player_peer.on('signal', data => {
        token_screen(data);
    });

    window.player_peer.on('connect', _ => {
        console.log('[player] player connected!');
    });

    window.player_peer.signal(token);
}

function json_to_b64(data) {
    return btoa(JSON.stringify(data));
}

function b64_to_json(data) {
    return JSON.parse(atob(data));
}

function is_host() {
    return 'host_peers' in window;
}