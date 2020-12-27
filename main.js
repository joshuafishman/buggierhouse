const SOCK_URL = "wss://13.68.255.132:8765/";

function update_piece_counts(bughouse_counts) {  
    for (let i=0; i<4; i++) {
        let our_str = "<td>0</td>";

        for (let j=0; j<5; j++) {
            our_str += `<td>${bughouse_counts[i][j]}</td>`;
        }

        window.counts[i].innerHTML = our_str;
    }
}

function update_chess_clock(clocks) {
    if (clocks[window.player] <= 0) {
        we_won_the_game();
        return;
    }

    for (let i=0; i<4; i++) {
        window.time_dom[i].innerText = `${Math.floor(clocks[i]/60)}:${(clocks[i]%60).toFixed(1)}`;
    }
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

function update_gui(animate) {
    const dicts = window.game.getBoardDicts();

    window.my_board.position(dicts[+(window.player == 1 || window.player == 2)], animate);
    window.their_board.position(dicts[+(window.player == 0 || window.player == 3)], animate);

    update_piece_counts(window.game.getBugs());
}

function handle_message(event) {
    const data = JSON.parse(event.data);

    if (data['msg'] == 'all_connected') {
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
        update_gui(true);

        window.clock.hit(move_player);
    } else if (data['msg'] == 'game_over') {
        const msg = data['victory_msg'];

        clearInterval(window.chessInterval);
        alert(`Game over!\n${msg}`);
        start_game();
    } else if (data['msg'] == 'game_created') {
        window.location.hash =  "#" + encodeURIComponent(data['game_id']);

        const url_dom = document.getElementById('connection_url');
        url_dom.href = window.location.href;
        url_dom.innerText = window.location.href;
        
        document.getElementById('create_0').style = 'display:none';
        document.getElementById('create_1').style = 'display:block';
        create_screen();
    } else if (data['msg'] == 'join_success') {
        if (data['success']) {
            waiting_screen();
        } else {
            alert('Joining failed, make sure you selected the right player.');
            join_screen();
        }
    } else if (data['msg'] == 'reconnected') {
        // Sync to a refreshed player
        send_msg('sync', {
            'serialization':window.game.serialize(),
            'pool':window.pool_param,
            'inc':window.inc_param,
            'clocks':window.clock.clocks,
            'clock_times':window.clock.clock_times
        });

    } else if (data['msg'] == 'sync' && isNaN(window.game)) {
        window.pool_param = data['pool']
        window.inc_param = data['inc']
        start_game();

        window.game.deserialize(data['serialization']);
        window.clock.clocks = data['clocks'];
        window.clock.clock_times = data['clock_times'];

        // Set GUIs
        update_gui(false);
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
    let victory_message = prompt('You won! Type your victory message below.');

    if (victory_message == null) victory_message = `Team ${1+(window.player >= 2)} won!`;
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
            const is_valid = window.game.doMove(window.player, source, target, piece);
            
            if (!is_valid) return 'snapback';

            update_gui(false);

            if (window.game.isOver()) {
                we_won_the_game();
                return;
            }

            window.clock.hit(window.player);

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

    window.time_dom = [null, null, null, null]
    window.time_dom[window.player] = document.getElementById('my_time');
    window.time_dom[3-window.player] = document.getElementById('their_time');

    for (let i=0; i<4; i++) {
        if (window.time_dom[i] != null) continue;

        if (i%2 == 0) window.time_dom[i] = document.getElementById('other_board_white_time');
        else window.time_dom[i] = document.getElementById('other_board_black_time');
    }


    if (window.clock) window.clock.reset();
    else window.clock = new Clock(window.pool_param, window.inc_param, update_chess_clock);

    update_gui(false);
    play_screen();
}

// Create a game as host and set up connection edges with handlers.
function create_game() {
    window.pool_param = parseFloat(document.getElementById('pool_input').value)*60;
    window.inc_param = parseFloat(document.getElementById('inc_input').value);
    window.player = parseInt(document.getElementById('player_input').value);

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

function join_game() {
    const game_id = decodeURIComponent(window.location.hash.substring(1));
    window.player = parseInt(document.getElementById('join_player_input').value);

    send_msg('join', {'game_id':game_id, 'player':window.player});

    loading_screen();
}

function start_app() {
    window.sock = new WebSocket(`ws://${window.location.host}`);
    window.sock.onmessage = handle_message;

    if (window.location.hash.length == 0) {
        create_screen();
    } else join_screen();
}