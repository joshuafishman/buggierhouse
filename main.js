function update_piece_counts(white, black) {    
    let white_str = "<td>0</td>";
    for (let i=0; i<white.length; i++) {
        white_str += `<td>${white[i]}</td>`;
    }

    let black_str = "<td>0</td>";
    for (let i=0; i<black.length; i++) {
        black_str += `<td>${black[i]}</td>`;
    }

    window.white_dom.innerHTML = white_str;
    window.black_dom.innerHTML = black_str;
}

function fetch_board_states() {
    update_piece_counts([0,0,0,0,0], [0,0,0,0,0]);
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

function handle_message_host(data, player) {
    if (typeof data != "string") {
        data = String.fromCharCode.apply(null, data);
    }
    
    if (false) {

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
    } else {
        console.log(`[player] player data: ${data}`);
    }
}

function host_broadcast(data) {
    for (let i=0; i<4; i++) {
        if (i == window.player) continue;
        window.host_peers[i].send(data);
    }
}


function start_game() {
    if (isNaN(window.player) || isNaN(window.pool_param) || isNaN(window.inc_param)) {
        alert("Invalid params.");
        window.location = "/";
    }

    window.my_board = Chessboard('my_board', {
        dropOffBoard: 'snapback',
        sparePieces: true,
        pieceTheme:'img/{piece}.png',
        orientation: (window.player % 2 == 0) ? 'white' : 'black',
    });

    window.their_board = Chessboard('their_board', {
        pieceTheme:'img/{piece}.png'
    });

    window.my_board.start();
    window.their_board.start();

    const counts_mine = document.getElementById('my_piece_counts');
    const counts_theirs = document.getElementById('their_piece_counts');

    window.black_dom = window.player % 2 == 0 ? counts_theirs : counts_mine;
    window.white_dom = window.player % 2 == 0 ? counts_mine : counts_theirs;    

    window.time_mine = document.getElementById('my_time');
    window.time_theirs = document.getElementById('their_time');

    update_piece_counts([0,0,0,0,0], [0,0,0,0,0]);
    window.time_mine.innerHTML = window.time_theirs.innerHTML = window.pool_param;
    play_screen();
}

function create_game() {
    window.pool_param = parseFloat(document.getElementById('pool_input').value);
    window.inc_param = parseFloat(document.getElementById('inc_input').value);
    window.player = parseInt(document.getElementById('player_input').value);

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