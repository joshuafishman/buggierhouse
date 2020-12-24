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
    }

    static _name = "";
    // Piece names: Pawn=p, Bishop=b, Knight=k, Rook=r, Queen=q, King=K

    get name(){
        return this.constructor._name;
    }

    isMoveAllowed(coordinate){
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

class Clock{
    constructor(time_remaining, start_time, stopped){
        this.time_remaining = time_remaining;
        this.start_time = start_time;
        this.stopped = stopped;
    }
    get_time_remaining(){
        if (!this.stopped){
            return this.time_remaining- (this.start_time - seconds());
        }
        else{
            return this.time_remaining;
        }
    }
    set_time_remaining(time){
        this.time_remaining = time;
    }
    hit(){
        this.stopped = !this.stopped;
        this.start_time = seconds();
    }
}

class Board{
    static bug_order = "qrbnp"
    // static piece_order = [Queen, Rook, Bishop, Knight, Pawn]

    constructor(){
        this.whose_turn = 0;
        this.pieces = this.setup();
        this.extra_pieces = [[0, 0, 0, 0, 0], [0, 0, 0, 0, 0]]; 
        this.history = [this.serialize()];
    }

    setup(){
        const pieces = [[], []]
        for (let side = 0; side<2; side++){
            pieces[side].push(new King([4, 7*side], side))  
            pieces[side].push(new Queen([3, 7*side], side)) 
            
            for (let j =0; j<2; j++){
                let sign = j ? -1:1;
                pieces[side].push(new Rook([7*j + 0*sign, 7*side], side));
                pieces[side].push(new Knight([7*j + 1*sign, 7*side], side));
                pieces[side].push(new Bishop([7*j + 2*sign, 7*side], side));
            }

        
            let sign = side ? -1:1;
            for (let j =0; j<8; j++){
                pieces[side].push(new Pawn([j, 7*side+sign], side));
            }
        }
        return pieces;
    }

    serialize(){
        const state = [];
        for (let i=0; i<64; i++){
            state.push("-");
        } 
        var side, piece;
        for (side of this.pieces){
            for (piece of side){
                let str = piece.name;
                if (piece.side){
                    str = str.toUpperCase();
                }
                state[piece.coordinate[1]*8 + piece.coordinate[0]] = str;
            }
        }
        // TODO:include extra pieces
        return state;
    }

    isPathClear(c1, c2){
        const vector = coordDiff(c2, c1);
        const len = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
        const unit_vector = vector.map(Math.sign);

        for (let i = 1; i<len; i++){
            let c = coordSum(c1, coordMul(unit_vector, i));  
            if (c == c2){
                break;
            }
            var side, piece;
            for (side of this.pieces){
                for (piece of side){
                    if (piece.coordinate.toString() == c.toString()){
                        return false;
                    }
                }
            }
        }
        return true;
    }

    doMove(side, from_square, to_square){
        if (side != this.whose_turn){
            console.log("eez not your turn");
            return -1;
        }

        var piece;
        for (piece of this.pieces[+side]){
            if (piece.coordinate.toString() == from_square.toString()){
                break;
            }
        }
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
        if (move.piece.side != this.whose_turn){
            console.log("Nice try Mr. Spy");
            return -1;
        } 

        var piece;
        for (piece of this.pieces[+this.whose_turn]){
            if (piece.coordinate.toString() == move.coordinate.toString()){
                console.log("Friendly fire :(");
                return -1;
            }
        }

        if (!move.isNew){
            if (!move.piece.isMoveAllowed(move.coordinate)){
                console.log("Learn how your pieces move, nitwit");
                return -1;
            }
            if (move.piece.name != "n" &&  !this.isPathClear(move.piece.coordinate, move.coordinate)){
                console.log("Try going around next time...");
                return -1;
            }
        }

        else{
            var piece;
            for (piece of this.pieces[+!this.whose_turn]){
                if (piece.coordinate.toString() == move.coordinate.toString()){
                    console.log("Nice try, but that's not how bughouse works");
                    return -1;
                }
            }
        }

        let king_coordinate = this.pieces[+this.whose_turn][0].coordinate;
        if (move.piece.name == "k" ){
            king_coordinate = move.coordinate;
        }

        var piece;
        for (piece of this.pieces[+!this.whose_turn]){
            if (piece.coordinate.toString() != move.coordinate.toString() && piece.isMoveAllowed(king_coordinate)){
                if (move.piece.name == "n" ||  this.isPathClear(piece.coordinate, king_coordinate)){
                    console.log("Protect your commander! Semper Fi!");
                    return -1;
                }
            }
        }

        if (move.piece.name == "p"){
            const vector = coordDiff(move.coordinate, move.piece.coordinate);

            let intersect_piece = null;
            var piece;
            for (piece of this.pieces[+!this.whose_turn]){
                if (piece.coordinate.toString() == move.coordinate.toString()){
                    intersect_piece = piece;
                }
            }
            
            if (vector[0] == 0){
                if (intersect_piece != null){
                    console.log("You are merely a pawn")
                    return -1;
                }
            }
            else{
                if (intersect_piece === null){
                    console.log("Don't go off sideways")
                    return -1;
                }
            }
        }

        // move is valid 
        let taken_piece = 0;

        if (!move.isNew){
            move.piece.coordinate = move.coordinate;
            for (let i = 0; i<this.pieces[+!this.whose_turn].length; i++){
                const piece = this.pieces[+!this.whose_turn][i];
                if (piece.coordinate.toString() == move.coordinate.toString()){
                    taken_piece = piece.name;
                    console.log(this.pieces[+!this.whose_turn].splice(i, 1));
                    i--;
                }
            }
        }
        else{
            this.pieces[+this.whose_turn].push(move.piece);

            const extra_idx = Board.bug_order.search(move.piece.name);
            this.extra_pieces[+this.whose_turn][extra_idx]--;
        }
                
        this.history.push(this.serialize());

        this.whose_turn = !this.whose_turn;
        return taken_piece;
    }
    print(){
        console.log(this.extra_pieces[0]);
        const b = this.serialize();
        let out = ""
        for (let i = 0; i<8; i++){
            out += b.slice(i*8, i*8+8).reduce(function(a, b){return a+ " " + b;});
            out += "\n";
        }
        console.log(out);
        console.log(this.extra_pieces[1]);

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

        if (out != 0){
            const extra_idx = Board.bug_order.search(out);
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
}


///////////////// PIECE IMPLEMENTATIONS ???????????????????????????


class Pawn extends Piece{
    static _name = "p";

    isMoveAllowed(coordinate){
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

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (Math.abs(vector[1]) < 2 && Math.abs(vector[0]) < 2);
    }
}

class Bishop extends Piece{
    static _name = "b";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (Math.abs(vector[1]) == Math.abs(vector[0]));
    }
}

class Rook extends Piece{
    static _name = "r";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (vector[1] == 0 || vector[0] == 0);
    }
}

class Queen extends Piece{
    static _name = "q";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (vector[1] == 0 || vector[0] == 0 || Math.abs(vector[1]) == Math.abs(vector[0]));
    }
}

class Knight extends Piece{
    static _name = "n";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        const larger = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
        const smaller = Math.min(Math.abs(vector[0]), Math.abs(vector[1]));
        return (larger == 2 && smaller == 1);
    }
}
