//////////////// UTILITIES ////////////////////////

function coordSum(c1, c2){
    return [c1[0] + c2[0], c1[1] + c2[1]];
}
function coordDiff(c1, c2){
    return [c1[0] - c2[0], c1[1] - c2[1]];
}
function coordMul(c, k){
    return [c[0] * k, c[1] * k];
}

function seconds(){
    return new Date().getTime()/1000;
}

//////////////// CHESS FUNCTIONALITY ///////////////////////////

class Piece{ // abstract class
    constructor(coordinate, side){
        this.coordinate = coordinate; //int[2]
        this.side = side; //bool
        this.dirty = false;
        this.was_pawn = false;
    }

    static _name = "";
    // Piece names: Pawn=p, Bishop=b, Knight=k, Rook=r, Queen=q, King=K

    get name(){
        return this.constructor._name;
    }

    validMove(coordinate){
        return false;
    }
}

class Move{
    constructor(piece, coordinate, isNew){
        this.piece = piece;
        this.isNew = isNew;
        this.coordinate = coordinate;
    }
}

class Board{
    static bug_order = "qrbnp"
    // static piece_order = [Queen, Rook, Bishop, Knight, Pawn]

    constructor(){
        this.pieces = [];
        this.whose_turn = 0;
        this.squares_last_updated = -1;
        this.squares = [];
        this.num_turns = 0;
        this.history = [];
        this.extra_pieces = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; 
        this.empty = new Empty();
        this.setup();
    }

    setupPieces(){
        const pieces = [[], []]
        // for (let side = 0; side<2; side++){
        //     pieces[side].push(new King([4, 7*side], side))  
        //     pieces[side].push(new Queen([3, 7*side], side)) 
            
        //     for (let j =0; j<2; j++){
        //         let sign = j ? -1:1;
        //         pieces[side].push(new Rook([7*j + 0*sign, 7*side], side));
        //         pieces[side].push(new Knight([7*j + 1*sign, 7*side], side));
        //         pieces[side].push(new Bishop([7*j + 2*sign, 7*side], side));
        //     }

        
        //     let sign = side ? -1:1;
        //     for (let j =0; j<8; j++){
        //         pieces[side].push(new Pawn([j, 7*side+sign], side));
        //     }
        // }
        pieces[0].push(new King([4, 0], 0));
        pieces[1].push(new King([4, 7], 1));
        // pieces[1].push(new Pawn([5, 1], 1));
        pieces[0].push(new Rook([7, 0], 0));

        this.pieces = pieces;
    }

    updateSquares(){
        if(this.num_turns == this.squares_last_updated){
            return;
        }
        
        const squares = [];
        for (let i=0; i<8; i++){
            let file = [];
            for (let j=0; j<8; j++){
                file.push(this.empty);
            } 
            squares.push(file);
        } 
        for (let side of this.pieces){
            for (let piece of side){
                squares[piece.coordinate[0]][piece.coordinate[1]] = piece;
            }
        }
        this.squares = squares;
        this.squares_last_updated++;
    }

    getSquare(coord){
        this.updateSquares();
        return this.squares[coord[0]][coord[1]];
    }

    getBoardString(){
        const state = [];
        for (let i=0; i<8; i++){
            for (let j=0; j<8; j++){
                let piece = this.getSquare([i, j]); 
                let str = piece.name;
                if (piece.side){
                    str = str.toUpperCase();
                }
                state[j*8 + i] = str; // transpose from file-rank to row-col
            }
        }
        // TODO:include extra pieces
        return state;
    }

    setup(){
        this.setupPieces();
        this.updateSquares();
        this.history.push(this.getBoardString());
    }

    isPathClear(c1, c2, blocked_square=[-1, -1]){
        const vector = coordDiff(c2, c1);
        const len = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
        const unit_vector = vector.map(Math.sign);

        for (let i = 1; i<len; i++){
            let c = coordSum(c1, coordMul(unit_vector, i));  
            if (c == c2){
                break;
            }
            if (this.getSquare(c) !== this.empty || c.toString() == blocked_square.toString()){
                return false;
            }
        }
        return true;
    }

    check_attack(c, exclude_piece, blocked_square=[-1, -1]){
        for (let piece of this.pieces[+!this.whose_turn]){
            if (piece !== exclude_piece && piece.validMove(c)){
                if (piece.name == "n" ||
                    this.isPathClear(piece.coordinate, c, blocked_square)){                    
                    return true;
                }
            }
        }
        return false;
    }

    doMove(side, from_square, to_square){
        if (side != this.whose_turn){
            console.log("eez not your turn");
            return -1;
        }

        const piece = this.getSquare(from_square);
        console.log(piece);
        
        return this._doMove(new Move(piece, to_square, false));
    }

    doBug(side, piece_name, to_square){
        if (side != this.whose_turn){
            console.log("Nice try Mr. Spy");
            return -1;
        }

        let piece = null;
        if (piece_name=="q"){
            piece = new Queen(to_square, side);
        }
        if (piece_name=="b"){
            piece = new Bishop(to_square, side);
        }
        if (piece_name=="p"){
            piece = new Pawn(to_square, side);
        }
        if (piece_name=="k"){
            piece = new Knight(to_square, side);
        }
        if (piece_name=="r"){
            piece = new Rook(to_square, side);
        }
        console.log(piece);
        
        return this._doMove(new Move(piece, to_square, true));
    }

    _doMove(move){
        if(move.piece === this.empty){
            console.log("*Flails at air uselessly*");
            return -1;
        }
        if (move.piece.side != this.whose_turn){
            console.log("Nice try Mr. Spy");
            return -1;
        } 

        const taken_piece = this.getSquare(move.coordinate);

        if (taken_piece.side == move.piece.side){
            console.log("Friendly fire :(");
            return -1; 
        }

        if (!move.isNew){
            const move_type = move.piece.validMove(move.coordinate);
            if (!move_type){
                console.log("Learn how your pieces move, nitwit");
                return -1;
            }

            if (move.piece.name != "n" &&  !this.isPathClear(move.piece.coordinate, move.coordinate)){
                console.log("Try going around next time...");
                return -1;
            }
            
            if (move.piece.name == "p"){ // pawn
                const vector = coordDiff(move.coordinate, move.piece.coordinate);
                   
                if (vector[0] == 0){
                    if (taken_piece !== this.empty){
                        console.log("You are merely a pawn")
                        return -1;
                    }
                }
                else{
                    if (taken_piece === this.empty){
                        console.log("Don't go off sideways")
                        return -1;
                    }
                }
            }

            if(move_type[0] == "c"){ // castle
                let king = move.piece;

                if(king.dirty){
                    console.log("you dirty boy ;)");
                    return -1;
                }

                let rook = null;
                let king_start = null;
                let king_end = null;
                if(move_type[1] == "k"){
                    rook = this.getSquare([7, king.coordinate[1]]);
                    king_start = 4;
                    king_end = 6;
                }
                if(move_type[1] == "q"){
                    rook = this.getSquare([0, king.coordinate[1]]);
                    king_start = 2;
                    king_end = 4;
                }

                if (rook.name != 'r' || rook.dirty){
                    console.log("Rookie mistake!");
                    return -1;
                }

                if (!this.isPathClear(rook.coordinate, king.coordinate)){
                    console.log("Try going around next time...");
                    return -1;
                }

                for(let i = king_start; i <= king_end; i++){
                    if(this.check_attack([i, king.coordinate[1]], this.empty)){
                        console.log("Cas(h)(tle) or check?");
                        return -1;
                    }
                }

                if(move_type[1] == "k"){
                    rook.coordinate = [5, king.coordinate[1]];
                }
                if(move_type[1] == "q"){
                    rook.coordinate = [3, king.coordinate[1]];
                }
            }
        }

        else{
            if (taken_piece.side == !move.piece.side){
                console.log("Nice try, but that's not how bughouse works");
                return -1;
            }
        }

        let king_coordinate = this.pieces[+this.whose_turn][0].coordinate;
        if (move.piece.name == "k" ){
            king_coordinate = move.coordinate;
        }
        if (this.check_attack(king_coordinate, taken_piece, move.coordinate)){
            console.log("Protect your commander! Semper Fi!");
            return -1;
        }

        // move is valid 
        console.log(taken_piece);

        if (move.piece.name in ["k", "r"]){
            move.piece.dirty = true;
        }

        if (!move.isNew){
            if (taken_piece !== this.empty){
                this.pieces[+!this.whose_turn] = this.pieces[+!this.whose_turn].filter(
                    function(p) {return p !== taken_piece});
            }
            move.piece.coordinate = move.coordinate;

            if (move.piece.name == 'p' && move.piece.coordinate[1] in [0, 7]){

                this.pieces[+this.whose_turn] = this.pieces[+this.whose_turn].filter(
                    function(p) {return p !== move.piece}); 

                move.piece = new Queen(move.piece.coordinate, move.piece.side);
                move.piece.was_pawn = true;
                this.pieces[+this.whose_turn].push(move.piece);    
            }
        }
        else{
            this.pieces[+this.whose_turn].push(move.piece);

            const extra_idx = Board.bug_order.search(move.piece.name);
            this.extra_pieces[+this.whose_turn][extra_idx]--;
        }
        
        this.num_turns++;
        this.updateSquares();
        this.history.push(this.getBoardString());
        this.whose_turn = !this.whose_turn;
        return taken_piece;
    }
    print(){
        this.updateSquares();
        console.log(this.extra_pieces[0]);
        const b = this.getBoardString();
        let out = ""
        for (let i = 0; i<8; i++){
            out += b.slice(i*8, i*8+8).reduce(function(a, b){return a+ " " + b;});
            out += "\n";
        }
        console.log(out);
        console.log(this.extra_pieces[1]);
    }

    getDict() {
        const d = {};
        for (let side of this.pieces) {
            for (let piece of side) {
                const loc = (piece.coordinate[0]+10).toString(36) + (piece.coordinate[1]+1).toString();
                const color = piece.side == 0 ? 'w' : 'b';

                d[loc] = color + piece.name.toUpperCase();
            }
        }

        return d;
    }
}           

class Bughouse{
    constructor(){
        this.boards = [new Board(), new Board()];   
    }

    parse_square(square){
        const order = "abcdefgh";
        const col = order.search(square[0]);
        const row = parseInt(square[1]) - 1;
        return [col, row];
    }

    doMove(player_id, from_square, to_square, piece_type){
        const board_id = Boolean(Math.sign(player_id % 3));
        const board = this.boards[+board_id];
        const side = Boolean(player_id % 2);

        let out = null;
        if(from_square == "spare"){
            const piece_name = piece_type[1].toLowerCase();
            out = board.doBug(side, piece_name, this.parse_square(to_square));
        }

        else{
            out = board.doMove(side, this.parse_square(from_square), this.parse_square(to_square));
        }

        if (out == -1){
            return false;
        }

        if (out.name != "-"){
            const extra_idx = Board.bug_order.search(out.was_pawn ? 'p':out.name);
            if (extra_idx != -1){
                this.boards[+!board_id].extra_pieces[+!side][extra_idx]++;
            }
        }

        return true;   
    }
    isOver() {
        return false;
    }
    print(){
        this.boards[0].print();
        this.boards[1].print();
    }
    getBugs(){
        return[this.boards[0].extra_pieces[0],
               this.boards[1].extra_pieces[1],
               this.boards[1].extra_pieces[0],
               this.boards[0].extra_pieces[1]];
    }

    getTurns() {
        // zero indexed turn numbers
        return [this.boards[0].history.length - 1, this.boards[1].history.length - 1];
    }

    serialize() {
        // TODO: return a string that can be parsed with deserialize() into the same thing
        return "";
    }

    deserialize(serialization) {
        // TODO: parse the serialization and update the state
    }

    getBoardDicts() {        
        return [this.boards[0].getDict(), this.boards[1].getDict()];
    }
}


///////////////// PIECE IMPLEMENTATIONS ???????????????????????????
class Empty extends Piece{
    constructor(){
        super(null, null);
    }
    static _name = "-";
}

class Pawn extends Piece{
    static _name = "p";

    validMove(coordinate){
        const sign = this.side ? -1:1;
        const vector = coordDiff(coordinate, this.coordinate);

        if (vector[1] == sign && Math.abs(vector[0]) < 2){
            return true;
        }
        if(vector[1] == sign*2 && vector[0] == 0){
            if(this.coordinate[1] == 7*this.side + sign){ // 2nd rank
                return true;
            }
        }
        return false;
    }
}

class King extends Piece{
    static _name = "k";

    validMove(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        if (Math.abs(vector[1]) < 2 && Math.abs(vector[0]) < 2){
            return true;
        }
        if(this.coordinate[1] == 7*this.side && this.coordinate[0] == 4){
            if(vector[1] == 0){
                if(vector[0] == 2){
                    return "ck";
                }
                if(vector[0] == -2){
                    return "cq";
                }
            }
        }
        return false;
    }
}

class Bishop extends Piece{
    static _name = "b";

    validMove(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (Math.abs(vector[1]) == Math.abs(vector[0]));
    }
}

class Rook extends Piece{
    static _name = "r";

    validMove(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (vector[1] == 0 || vector[0] == 0);
    }
}

class Queen extends Piece{
    static _name = "q";

    validMove(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (vector[1] == 0 || vector[0] == 0 || Math.abs(vector[1]) == Math.abs(vector[0]));
    }
}

class Knight extends Piece{
    static _name = "n";

    validMove(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        const larger = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
        const smaller = Math.min(Math.abs(vector[0]), Math.abs(vector[1]));
        return (larger == 2 && smaller == 1);
    }
}

class Clock {
    constructor(pool, inc, on_update) {
        this.pool = pool
        this.inc = inc
        this.on_update = on_update

        this.reset();

        this.interval = setInterval(() => this.update(), 40);
    }

    update() {
        const temp_time = new Date().getTime();

        for (let i=0; i<4; i++) {
            if (this.clock_times[i] == null) continue;

            const delta = temp_time - this.clock_times[i];
            this.clock_times[i] = temp_time;
            this.clocks[i] -= delta/1000;
        }

        if (this.on_update) this.on_update(this.clocks);
    }

    reset() {
        this.clocks = [this.pool, this.pool, this.pool, this.pool]
        this.clock_times = [null, null, null, null]
    }

    hit(player) {
        this.clocks[player] += this.inc;
        this.clock_times[player]   = null;
        this.clock_times[3-player] = new Date().getTime();
    }

}