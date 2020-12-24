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
    constructor(){
        this.whose_turn = 0;
        this.pieces = this.setup();
        this.extra_pieces = [[], []]; 
        this.clocks = [new Clock(600, seconds(), false), new Clock(600, seconds(), true)];
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
        let unit_vector = coordDiff(c2, c1)
        unit_vector = [Math.sign(unit_vector[0]), Math.sign(unit_vector[1])]

        for (let i = 1; i<=8; i++){
            let c = coordSum(c1, coordMul(unit_vector, i));  
            if (c == c2){
                break;
            }
            var side, piece;
            for (side of this.pieces){
                for (piece of side){
                    if (piece.coordinate == c){
                        return false;
                    }
                }
            }
        }
        return true;
    }

    moveListenerCallback(move){
        if (move.piece.side != this.whose_turn){
            console.log("Nice try Mr. Spy")
            return null
        } 

        var piece;
        for (piece of this.pieces[+this.whose_turn]){
            if (piece.coordinate.toString() == move.coordinate.toString()){
                console.log("Friendly fire :(")
                return null
            }
        }

        if (!move.isNew){
            if (!move.piece.isMoveAllowed(move.coordinate)){
                console.log("Learn how your pieces move, nitwit")
                return null;
            }
            if (move.piece.name != "k" &&  !this.isPathClear(move.piece.coordinate, move.coordinate)){
                console.log("Try going around next time...")
                return null;
            }
        }

        else{
            var piece;
            for (piece of this.pieces[+!this.whose_turn]){
                if (piece.coordinate.toString() == move.coordinate.toString()){
                    console.log("Nice try, but that's not how bughouse works")
                    return null
                }
            }
        }

        let king_coordinate = this.pieces[+this.whose_turn][0].coordinate;
        if (move.piece.name == "k" ){
            king_coordinate = move.coordinate;
        }

        var piece;
        for (piece of this.pieces[+!this.whose_turn]){
            if (piece.coordinate != king_coordinate  && piece.isMoveAllowed(king_coordinate)){
                if (move.piece.name == "n" ||  this.isPathClear(piece.coordinate, king_coordinate)){
                    console.log("Protect your commander! Semper Fi!")
                    return null;
                }
            }
        }

        // move is valid
        this.clocks[+this.whose_turn].hit();

        move.piece.coordinate = move.coordinate;
        let taken_piece = null;
        for (let i = 0; i<this.pieces[+!this.whose_turn].length; i++){
            const piece = this.pieces[+!this.whose_turn][i];
            if (piece.coordinate.toString() == move.coordinate.toString()){
                taken_piece = piece;
                this.pieces[+!this.whose_turn].splice(i);
                i--;
            }
        }
                
        this.history.push(this.serialize());

        this.whose_turn = !this.whose_turn;
        this.clocks[+this.whose_turn].hit();
        return taken_piece;
    }
    print(){
        const b = this.serialize();
        let out = ""
        for (let i = 0; i<8; i++){
            out += b.slice(i*8, i*8+8).reduce(function(a, b){return a+ " " + b;});
            out += "\n";
        }
        console.log(out);
    }
}           

class Bughouse{
    constructor(){
        this.boards = [new Board(), new Board()]; 
        this.listener1 = new moveListener(this.boards[0].moveListenerCallback);
        this.listener2 = new moveListener(this.boards[1].moveListenerCallback);    
    }
   // TODO give extra pieces
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
            if(this.coordinate[1] == 8*this.side + sign){ // 2nd rank
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
        return (Math.abs(vector[1]) < 2 && Math.abs(vector[2]) < 2);
    }
}

class Bishop extends Piece{
    static _name = "b";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (Math.abs(vector[1]) == Math.abs(vector[2]));
    }
}

class Rook extends Piece{
    static _name = "r";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (vector[1] == 0 || vector[2] == 0);
    }
}

class Queen extends Piece{
    static _name = "q";

    isMoveAllowed(coordinate){
        const vector = coordDiff(coordinate, this.coordinate);
        return (vector[1] == 0 || vector[2] == 0 || Math.abs(vector[1]) == Math.abs(vector[2]));
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