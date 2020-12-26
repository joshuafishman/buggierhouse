const SOCK_URL = "ws://127.0.0.1:8765/";

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
    document.getElementById('join_screen').style = 'display:none'; 
    document.getElementById('loading_screen').style = 'display:none'; 
    document.getElementById('waiting_screen').style = 'display:none'; 
}

function play_screen() {
    document.getElementById('play_screen').style = 'display:block';
    document.getElementById('create_screen').style = 'display:none'; 
    document.getElementById('join_screen').style = 'display:none'; 
    document.getElementById('loading_screen').style = 'display:none';
    document.getElementById('waiting_screen').style = 'display:none';  
}

function join_screen() {
    document.getElementById('join_screen').style = 'display:block'; 
    document.getElementById('play_screen').style = 'display:none';
    document.getElementById('create_screen').style = 'display:none';  
    document.getElementById('loading_screen').style = 'display:none'; 
    document.getElementById('waiting_screen').style = 'display:none'; 
}

function loading_screen() {
    document.getElementById('loading_screen').style = 'display:block'; 
    document.getElementById('join_screen').style = 'display:none'; 
    document.getElementById('play_screen').style = 'display:none';
    document.getElementById('create_screen').style = 'display:none';  
    document.getElementById('waiting_screen').style = 'display:none'; 
}

function waiting_screen() {
    document.getElementById('waiting_screen').style = 'display:block'; 
    document.getElementById('loading_screen').style = 'display:none'; 
    document.getElementById('join_screen').style = 'display:none'; 
    document.getElementById('play_screen').style = 'display:none';
    document.getElementById('create_screen').style = 'display:none';     
}

function copy_url() {
    var $temp = $('<input>');
    $('body').append($temp);
    $temp.val($('#connection_url').text()).select();
    document.execCommand('copy');
    $temp.remove();
}

function drop_piece(board, position, piece) {
    const pos = board.position();
    pos[position] = piece;
    board.position(pos, false);
}

function handle_message(event) {
    const data = JSON.parse(event.data);

    if (data['msg'] == 'all_connected') {
        console.log(data);
        window.pool_param = data['pool'];
        window.inc_param  = data['inc'];

        console.log(`[player] connected as player ${window.player}`);

        start_game();
    } else if (data['msg'] == 'move') {
        const move_player = data['player'];
        const source = data['src'];
        const target = data['target'];
        const piece = data['piece'];

        console.log(`[player] got move ${data}`);

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
            if (source == 'spare') drop_piece(window.my_board, target, piece);
            else window.my_board.move(`${source}-${target}`);
        } else {
            if (source == 'spare') drop_piece(window.their_board, target, piece);
            else window.their_board.move(`${source}-${target}`);
        }
    } else if (data['msg'] == 'game_over') {
        const msg = data['victory_msg'];

        clearInterval(window.chessInterval);
        alert(`Game over!\n${msg}`);
        start_game();
    } else if (data['msg'] == 'game_created') {
        const url_dom = document.getElementById('connection_url');
        
        const url = window.location.href + "#" + encodeURIComponent(data['game_id']);
        url_dom.href = url;
        url_dom.innerText = url;

        document.getElementById('create_0').style = 'display:none';
        document.getElementById('create_1').style = 'display:block';
        create_screen();
    } else if (data['msg'] == 'join_success') {
        if (data['success']) waiting_screen();
        else {
            alert('Joining failed, make sure you selected the right player.');
            join_screen();
        }
    } else {
        console.log(`[player] player data: ${data}`);
    }
}

function send_msg(msg, data) {
    data['msg'] = msg;
    window.sock.send(JSON.stringify(data));
}

function we_won_the_game() {
    // Game is over, we won!
    const victory_message = prompt('You won! Type your victory message below.');
    send_msg('game_over', {'victory_msg':victory_message});
    
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

            send_msg('move', {
                'player':window.player,
                'src':source,
                'target':target,
                'piece':piece
            });
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
        send_msg('start', {
            'player':window.player,
            'pool':window.pool_param,
            'inc':window.inc_param
        });

        loading_screen();
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

function join_game() {
    const game_id = decodeURIComponent(window.location.hash.substring(1));
    window.player = parseInt(document.getElementById('join_player_input').value);

    send_msg('join', {'game_id':game_id, 'player':window.player});

    loading_screen();
}

function start_app() {
    window.sock = new WebSocket(SOCK_URL);
    window.sock.onmessage = handle_message;

    if (window.location.hash.length == 0) {
        create_screen();
    } else join_screen();
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