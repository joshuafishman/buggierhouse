//////////////// UTILITIES ////////////////////////

function coordSum(c1, c2) {
  return [c1[0] + c2[0], c1[1] + c2[1]];
}
function coordDiff(c1, c2) {
  return [c1[0] - c2[0], c1[1] - c2[1]];
}
function coordMul(c, k) {
  return [c[0] * k, c[1] * k];
}

function seconds() {
  return new Date().getTime() / 1000;
}

//////////////// CHESS FUNCTIONALITY ///////////////////////////

class Piece {
  // abstract class
  constructor(coordinate, side) {
    this.coordinate = coordinate; //int[2]
    this.side = side; //bool
    this.dirty = false;
    this.was_pawn = false;
    this.move_pawn_jumped_two_spaces = null;
    this.name = this.constructor._name;
  }

  static _name = "";
  // Piece names: Pawn=p, Bishop=b, Knight=k, Rook=r, Queen=q, King=K

  static deserialize(s) {
    const p = new NAME_TO_PIECE[s.name]();
    Object.assign(p, s);
    return p;
  }

  validMove(coordinate) {
    return false;
  }

  validAttack(coordinate) {
    return this.validMove(coordinate);
  }
}

class Move {
  constructor(piece, coordinate, isNew) {
    this.piece = piece;
    this.isNew = isNew;
    this.coordinate = coordinate;
  }
}

class Board {
  static bug_order = "qrbnp";
  // static piece_order = [Queen, Rook, Bishop, Knight, Pawn]

  constructor() {
    this.pieces = [];
    this.whose_turn = 0;
    this.num_turns = 0;
    this.history = [];
    this.extra_pieces = [
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ];
    this.empty = new Empty();
    this.setup();
  }

  static deserialize(s) {
    const b = new Board();
    Object.assign(b, s);
    b.pieces = b.pieces.map((p) => p.map(Piece.deserialize));
    return b;
  }

  setupPieces() {
    const pieces = [[], []];
    for (let side = 0; side < 2; side++) {
      pieces[side].push(new King([4, 7 * side], side));
      pieces[side].push(new Queen([3, 7 * side], side));

      for (let j = 0; j < 2; j++) {
        let sign = j ? -1 : 1;
        pieces[side].push(new Rook([7 * j + 0 * sign, 7 * side], side));
        pieces[side].push(new Knight([7 * j + 1 * sign, 7 * side], side));
        pieces[side].push(new Bishop([7 * j + 2 * sign, 7 * side], side));
      }

      let sign = side ? -1 : 1;
      for (let j = 0; j < 8; j++) {
        pieces[side].push(new Pawn([j, 7 * side + sign], side));
      }
    }

    this.pieces = pieces;
  }

  getSquares() {
    const squares = [];
    for (let i = 0; i < 8; i++) {
      let file = [];
      for (let j = 0; j < 8; j++) {
        file.push(this.empty);
      }
      squares.push(file);
    }

    for (let side of this.pieces) {
      for (let piece of side) {
        squares[piece.coordinate[0]][piece.coordinate[1]] = piece;
      }
    }

    return squares;
  }

  getSquare(coord) {
    const squares = this.getSquares();
    return squares[coord[0]][coord[1]];
  }

  getBoardString() {
    const state = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        let piece = this.getSquare([i, j]);
        let str = piece.name;
        if (piece.side) {
          str = str.toUpperCase();
        }
        state[j * 8 + i] = str; // transpose from file-rank to row-col
      }
    }
    // TODO:include extra pieces
    return state;
  }

  setup() {
    this.setupPieces();
    this.history.push(this.getBoardString());
  }

  isPathClear(c1, c2) {
    const vector = coordDiff(c2, c1);
    const len = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
    const unit_vector = vector.map(Math.sign);

    for (let i = 1; i < len; i++) {
      let c = coordSum(c1, coordMul(unit_vector, i));
      if (c == c2) {
        break;
      }
      if (this.getSquare(c) !== this.empty) {
        return false;
      }
    }
    return true;
  }

  check_attack(turn, c) {
    for (let piece of this.pieces[turn]) {
      if (piece.validAttack(c)) {
        if (
          piece.name == Knight._name ||
          this.isPathClear(piece.coordinate, c)
        ) {
          return true;
        }
      }
    }
    return false;
  }

  doMove(side, from_square, to_square) {
    if (side != this.whose_turn) {
      console.log("eez not your turn");
      return -1;
    }

    const piece = this.getSquare(from_square);

    return this._doMove(new Move(piece, to_square, false));
  }

  doBug(side, piece_name, to_square) {
    if (side != this.whose_turn) {
      console.log("Nice try Mr. Spy");
      return -1;
    }

    const piece = this.getPieceFromName(side, piece_name, to_square);
    if (piece != null) {
      return this._doMove(new Move(piece, to_square, true));
    } else {
      return -1;
    }
  }

  getPieceFromName(side, piece_name, to_square) {
    let piece = null;
    if (piece_name == "q") {
      piece = new Queen(to_square, side);
    }
    if (piece_name == "b") {
      piece = new Bishop(to_square, side);
    }
    if (piece_name == Pawn._name && to_square[1] != 0 && to_square[1] != 7) {
      piece = new Pawn(to_square, side);
    }
    if (piece_name == "k") {
      piece = new Knight(to_square, side);
    }
    if (piece_name == "r") {
      piece = new Rook(to_square, side);
    }

    return piece;
  }

  _doMove(move) {
    if (move.piece === this.empty) {
      console.log("*Flails at air uselessly*");
      return -1;
    }
    if (move.piece.side != this.whose_turn) {
      console.log("Nice try Mr. Spy");
      return -1;
    }

    const piece_on_target_square = this.getSquare(move.coordinate);
    const try_en_passant =
      piece_on_target_square == this.empty &&
      move.piece.name == Pawn._name &&
      move.coordinate[0] != move.piece.coordinate[0];
    const taken_piece = try_en_passant
      ? move.piece.pieceTakenByEnPassant(this, move.coordinate)
      : piece_on_target_square;

    if (taken_piece.side == move.piece.side) {
      // console.log("Friendly fire :(");
      return -1;
    }

    if (!move.isNew) {
      const move_type = move.piece.validMove(move.coordinate);
      if (!move_type) {
        // console.log("Learn how your pieces move, nitwit");
        return -1;
      }

      if (
        move.piece.name != "n" &&
        !this.isPathClear(move.piece.coordinate, move.coordinate)
      ) {
        // console.log("Try going around next time...");
        return -1;
      }

      if (move.piece.name == Pawn._name) {
        // pawn
        const vector = coordDiff(move.coordinate, move.piece.coordinate);

        if (vector[0] == 0) {
          if (taken_piece !== this.empty) {
            // console.log("You are merely a pawn");
            return -1;
          }
        } else {
          if (taken_piece === this.empty) {
            // console.log("Don't go off sideways");
            return -1;
          }
        }
      }

      if (move_type[0] == "c") {
        // castle
        let king = move.piece;

        if (king.dirty) {
          // console.log("you dirty boy ;)");
          return -1;
        }

        let rook = null;
        let king_start = null;
        let king_end = null;
        if (move_type[1] == "k") {
          rook = this.getSquare([7, king.coordinate[1]]);
          king_start = 4;
          king_end = 6;
        }
        if (move_type[1] == "q") {
          rook = this.getSquare([0, king.coordinate[1]]);
          king_start = 2;
          king_end = 4;
        }

        if (rook.name != "r" || rook.dirty) {
          // console.log("Rookie mistake!");
          return -1;
        }

        if (!this.isPathClear(rook.coordinate, king.coordinate)) {
          // console.log("Try going around next time...");
          return -1;
        }

        for (let i = king_start; i <= king_end; i++) {
          if (this.check_attack(+!this.whose_turn, [i, king.coordinate[1]])) {
            // console.log("Cas(h)(tle) or check?");
            return -1;
          }
        }

        if (move_type[1] == "k") {
          rook.coordinate = [5, king.coordinate[1]];
        }
        if (move_type[1] == "q") {
          rook.coordinate = [3, king.coordinate[1]];
        }
      }
    } else {
      if (taken_piece.side == !move.piece.side) {
        // console.log("Nice try, but that's not how bughouse works");
        return -1;
      }
    }

    const prior_state_json = JSON.stringify(this);

    // Move is valid, move it
    this.executeMove(move, taken_piece);

    let king_coordinate = this.pieces[+this.whose_turn][0].coordinate;
    if (this.check_attack(+!this.whose_turn, king_coordinate)) {
      this.restoreState(prior_state_json);
      // console.log("Protect your commander! Semper Fi!");
      return -1;
    }

    this.num_turns++;
    this.history.push(this.getBoardString());
    this.whose_turn = !this.whose_turn;
    return taken_piece;
  }

  restoreState(prior_state_json) {
    const recovered_state = JSON.parse(prior_state_json);
    Object.assign(this, recovered_state);
    this.pieces = this.pieces.map((p) => p.map(Piece.deserialize));
  }

  executeMove(move, taken_piece) {
    if (move.piece.name == "k" || move.piece.name == "r") {
      move.piece.dirty = true;
    }

    if (!move.isNew) {
      if (taken_piece !== this.empty) {
        this.pieces[+!this.whose_turn] = this.pieces[+!this.whose_turn].filter(
          (p) => p !== taken_piece
        );
      }

      // Moved 2 spaces
      if (
        move.piece.name == Pawn._name &&
        Math.abs(move.piece.coordinate[1] - move.coordinate[1]) > 1
      ) {
        move.piece.move_pawn_jumped_two_spaces = this.history.length;
      }

      move.piece.coordinate = move.coordinate;

      // Promotion
      if (
        move.piece.name == Pawn._name &&
        (move.piece.coordinate[1] == 0 || move.piece.coordinate[1] == 7)
      ) {
        this.pieces[+this.whose_turn] = this.pieces[+this.whose_turn].filter(
          (p) => p !== move.piece
        );

        move.piece = new Queen(move.piece.coordinate, move.piece.side);
        move.piece.was_pawn = true;
        this.pieces[+this.whose_turn].push(move.piece);
      }
    } else {
      this.pieces[+this.whose_turn].push(move.piece);

      const extra_idx = Board.bug_order.search(move.piece.name);
      this.extra_pieces[+this.whose_turn][extra_idx]--;
    }
  }

  print() {
    console.log(this.extra_pieces[0]);
    const b = this.getBoardString();
    let out = "";
    for (let i = 0; i < 8; i++) {
      out += b.slice(i * 8, i * 8 + 8).reduce(function (a, b) {
        return a + " " + b;
      });
      out += "\n";
    }
    console.log(out);
    console.log(this.extra_pieces[1]);
  }

  getDict() {
    const d = {};
    for (let side of this.pieces) {
      for (let piece of side) {
        const loc =
          (piece.coordinate[0] + 10).toString(36) +
          (piece.coordinate[1] + 1).toString();
        const color = piece.side == 0 ? "w" : "b";

        d[loc] = color + piece.name.toUpperCase();
      }
    }

    return d;
  }

  isOver() {
    const in_danger = +this.whose_turn;
    const attacker = +!this.whose_turn;

    let king_coordinate = this.pieces[in_danger][0].coordinate;

    if (this.check_attack(attacker, king_coordinate)) {
      let any_escape_move = false;

      for (
        let piece_i = 0;
        piece_i < this.pieces[in_danger].length;
        piece_i += 1
      ) {
        for (let i = 0; i < 8; i++) {
          for (let j = 0; j < 8; j++) {
            const target_coordinate = [i, j];

            const piece = this.pieces[in_danger][piece_i];
            const taken_piece = this.getSquare(target_coordinate);

            if (
              piece.validMove(target_coordinate) &&
              (!taken_piece || taken_piece.side != piece.side)
            ) {
              const prior_state_json = JSON.stringify(this);

              this._doMove(new Move(piece, target_coordinate, false));

              let new_king_coordinate = this.pieces[in_danger][0].coordinate;
              if (!this.check_attack(attacker, new_king_coordinate)) {
                console.log(
                  "Escape by moving the",
                  piece,
                  "to",
                  target_coordinate
                );
                console.log(king_coordinate, new_king_coordinate);
                any_escape_move = true;
              }

              this.restoreState(prior_state_json);
            }
          }
        }
      }

      for (let p = 0; p < this.extra_pieces[in_danger].length; p++) {
        if (this.extra_pieces[in_danger][p] > 0) {
          const piece_name = PIECE_INDEX_ORDER[p]._name;

          for (let i = 0; i < 8; i++) {
            for (let j = 0; j < 8; j++) {
              const target_coordinate = [i, j];

              if (this.getSquare(target_coordinate) == this.empty) {
                const prior_state_json = JSON.stringify(this);

                const piece = this.getPieceFromName(
                  in_danger,
                  piece_name,
                  target_coordinate
                );

                if (piece) {
                  this._doMove(new Move(piece, target_coordinate, true));

                  if (!this.check_attack(attacker, king_coordinate)) {
                    console.log(
                      "Escape by placing a",
                      piece,
                      "on",
                      target_coordinate
                    );
                    any_escape_move = true;
                  }

                  this.restoreState(prior_state_json);
                }
              }
            }
          }
        }
      }

      console.log("any_escape_move", any_escape_move);
      return !any_escape_move;
    }

    return false;
  }
}

function boardId(player_id) {
  return Boolean(Math.sign(player_id % 3));
}

class Bughouse {
  constructor() {
    this.boards = [new Board(), new Board()];
  }

  parse_square(square) {
    const order = "abcdefgh";
    const col = order.search(square[0]);
    const row = parseInt(square[1]) - 1;
    return [col, row];
  }

  doMove(player_id, from_square, to_square, piece_type) {
    const board_id = boardId(player_id % 3);
    const board = this.boards[+board_id];
    const side = Boolean(player_id % 2);

    if (board_id == boardId(window.player)) {
      new Audio("sound/whack.mp3").play();
    }

    let out = null;
    if (from_square == "spare") {
      const piece_name = piece_type[1].toLowerCase();
      out = board.doBug(side, piece_name, this.parse_square(to_square));
    } else {
      out = board.doMove(
        side,
        this.parse_square(from_square),
        this.parse_square(to_square)
      );
    }

    if (out == -1) {
      return false;
    }

    if (out.name != "-") {
      const extra_idx = Board.bug_order.search(
        out.was_pawn ? Pawn._name : out.name
      );
      if (extra_idx != -1) {
        this.boards[+!board_id].extra_pieces[+!side][extra_idx]++;
      }
    }

    return true;
  }

  isOver() {
    return this.boards[0].isOver() || this.boards[1].isOver();
  }

  print() {
    this.boards[0].print();
    this.boards[1].print();
  }

  getBugs() {
    return [
      this.boards[0].extra_pieces[0],
      this.boards[1].extra_pieces[1],
      this.boards[1].extra_pieces[0],
      this.boards[0].extra_pieces[1],
    ];
  }

  getTurns() {
    // zero indexed turn numbers
    return [
      this.boards[0].history.length - 1,
      this.boards[1].history.length - 1,
    ];
  }

  serialize() {
    return JSON.stringify(this.boards);
  }

  deserialize(serialization) {
    const b = JSON.parse(serialization);
    const d = b.map(Board.deserialize);
    this.boards = d;
  }

  getBoardDicts() {
    return [this.boards[0].getDict(), this.boards[1].getDict()];
  }
}

///////////////// PIECE IMPLEMENTATIONS ???????????????????????????
class Empty extends Piece {
  constructor() {
    super(null, null);
  }
  static _name = "-";
}

class Pawn extends Piece {
  static _name = "p";

  validMove(coordinate) {
    const sign = this.side ? -1 : 1;
    const vector = coordDiff(coordinate, this.coordinate);

    if (vector[1] == sign && Math.abs(vector[0]) < 2) {
      return true;
    }

    if (vector[1] == sign * 2 && vector[0] == 0) {
      if (this.coordinate[1] == 7 * this.side + sign) {
        // 2nd rank
        return true;
      }
    }

    // En pasant

    return false;
  }

  validAttack(coordinate) {
    const vector = coordDiff(coordinate, this.coordinate);
    return this.validMove(coordinate) && vector[0] != 0;
  }

  pieceTakenByEnPassant(board, coordinate) {
    const sign = this.side ? 1 : -1;
    const targetCoordinate = [coordinate[0], coordinate[1] + sign];

    const piece = board.getSquare(targetCoordinate);

    if (piece.move_pawn_jumped_two_spaces == board.history.length - 1) {
      return piece;
    } else {
      return board.empty;
    }
  }
}

class King extends Piece {
  static _name = "k";

  validMove(coordinate) {
    const vector = coordDiff(coordinate, this.coordinate);
    if (Math.abs(vector[1]) < 2 && Math.abs(vector[0]) < 2) {
      return true;
    }
    if (this.coordinate[1] == 7 * this.side && this.coordinate[0] == 4) {
      if (vector[1] == 0) {
        if (vector[0] == 2) {
          return "ck";
        }
        if (vector[0] == -2) {
          return "cq";
        }
      }
    }
    return false;
  }
}

class Bishop extends Piece {
  static _name = "b";

  validMove(coordinate) {
    const vector = coordDiff(coordinate, this.coordinate);
    return Math.abs(vector[1]) == Math.abs(vector[0]);
  }
}

class Rook extends Piece {
  static _name = "r";

  validMove(coordinate) {
    const vector = coordDiff(coordinate, this.coordinate);
    return vector[1] == 0 || vector[0] == 0;
  }
}

class Queen extends Piece {
  static _name = "q";

  validMove(coordinate) {
    const vector = coordDiff(coordinate, this.coordinate);
    return (
      vector[1] == 0 ||
      vector[0] == 0 ||
      Math.abs(vector[1]) == Math.abs(vector[0])
    );
  }
}

class Knight extends Piece {
  static _name = "n";

  validMove(coordinate) {
    const vector = coordDiff(coordinate, this.coordinate);
    const larger = Math.max(Math.abs(vector[0]), Math.abs(vector[1]));
    const smaller = Math.min(Math.abs(vector[0]), Math.abs(vector[1]));
    return larger == 2 && smaller == 1;
  }
}

const NAME_TO_PIECE = {
  [Pawn._name]: Pawn,
  [King._name]: King,
  [Queen._name]: Queen,
  [Rook._name]: Rook,
  [Bishop._name]: Bishop,
  [Knight._name]: Knight,
};

const PIECE_INDEX_ORDER = [Queen, Rook, Bishop, Knight, Pawn];

class Clock {
  constructor(pool, inc, on_update) {
    this.pool = pool;
    this.inc = inc;
    this.on_update = on_update;

    this.reset();

    this.interval = setInterval(() => this.update(), 40);
  }

  update() {
    const temp_time = new Date().getTime();

    for (let i = 0; i < 4; i++) {
      if (this.clock_times[i] == null) continue;

      const delta = temp_time - this.clock_times[i];
      this.clock_times[i] = temp_time;
      this.clocks[i] -= delta / 1000;
    }

    if (this.on_update) this.on_update(this.clocks);
  }

  reset() {
    this.clocks = [this.pool, this.pool, this.pool, this.pool];
    this.clock_times = [null, null, null, null];
  }

  hit(player) {
    this.clocks[player] += this.inc;
    this.clock_times[player] = null;
    this.clock_times[3 - player] = new Date().getTime();
  }
}
