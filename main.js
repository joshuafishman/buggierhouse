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
    const select = document.getElementById('join_player_input');
    const token_dom = document.getElementById('connection_token');

    token_dom.innerText = json_to_b64(token);
    window.player = parseInt(select.value);

    document.getElementById('play_screen').style = 'display:none';
    document.getElementById('create_screen').style = 'display:none';     
    document.getElementById('token_screen').style = 'display:block';   
}


function copy_token() {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val($("#connection_token").text()).select();
    document.execCommand("copy");
    $temp.remove();
}

function handle_message_host(data) {
    if (data.startsWith('CONNECTED_')) {
        const player = parseInt(data.split('_')[1]);

        console.log(`[host] Player ${player} connected!`);

        if (window.connected[player]) {
            alert(`Multiple users as player ${player}, aborting!`);
            return;
        }

        window.connected[player] = true;

        if (window.connected.every(v => v === true)) {
            // All connected, time to launch the game!!!
            window.host_peer.send(`ALLCONNECTED_${window.pool_param}_${window.inc_param}`);
            start_game();
        }
    } else {
        console.log(`[host] host data: ${data}`);
    }
}

function handle_message_player(data) {
    if (data.startsWith('ALLCONNECTED')) {
        window.pool_param = parseFloat(parseInt(data.split('_')[1]));
        window.inc_param  = parseFloat(parseInt(data.split('_')[2]));

        start_game();
    } else {
        console.log(`[player] player data: ${data}`);
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
        window.host_peer = new SimplePeer({
            initiator:true,
            trickle:false
        });

        window.host_peer.on('data', handle_message_host);

        window.host_peer.on('connect', _ => {
            console.log('[host] player connected to host!')
        });

        window.host_peer.on('error', err => console.log('error', err));
        window.host_peer.on('signal', data => {
            const json_b64 = json_to_b64(data);
            console.log(`Created host.`);
            parent.location.hash = encodeURIComponent(json_b64);

            document.getElementById('create_0').style = "display:none";
            document.getElementById('create_1').style = "display:block";
            
        });
    }
}

function start_host() {
    for (let i=0; i<3; i++) {
        const token = document.getElementById(`token_${i}`).value;
        window.host_peer.signal(b64_to_json(token));
    }

    document.getElementById('create_1').style = "display:none";
    document.getElementById('create_2').style = "display:block";

    window.connected = [false, false, false, false];
    window.connected[window.player] = true;
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
        window.player_peer.send(`CONNECTED_${window.player}`);
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
    return 'host_peer' in window;
}