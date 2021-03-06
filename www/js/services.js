/* global angular staticBoards */
/* exported STATUS SIDE HINTKIND */
var CELL = {
        NIL: -1,
        OFF: 0,
        ON: 1
    },
    STATUS = {
        SETUP: 'SETUP',
        GAME: 'GAME',
        OVER: 'OVER'
    },
    SIDE = {
        LEFT: 'L',
        RIGHT: 'R',
        TOP: 'T',
        BOTTOM: 'B'
    },
    HINTKIND = {
        TOP: 'tophint',
        BOTTOM: 'bottomhint',
        LEFT: 'lefthint',
        RIGHT: 'righthint'
    };

var BOARDKEY = 'board';


angular.module('crossbits.services', [])

.factory('LocalStorage', ['$window', function($window) {
    return {
        setObject: function(key, value) {
            $window.localStorage[key] = angular.toJson(value);
        },
        getObject: function(key) {
            return angular.fromJson($window.localStorage[key]);
        },
        delete: function(key) {
            $window.localStorage.removeItem(key);
        }
    };
}])

.factory('Game', function(LocalStorage) {

    var allBoards = [];
    var savedBoards = [];

    var sourceBoard = {};
    var boardData = [];
    var boardIndex = 0;
    var boardStatus = '';
    var boardSize = {x: 0, y: 0};

    function loadSavedBoards() {
        var index = 0, board = {};
        do {
            board = LocalStorage.getObject(BOARDKEY.concat(index));
            if (board) {
                savedBoards.push(board);
                index++;
            }
        } while (board);
        allBoards.push(savedBoards);
    }

    function initAllBoards() {
        return staticBoards.map(function(stage) {
            return stage.map(function(board) {
                var boardData = [];
                var width = board.columnHintData.length;
                var height = board.rowHintData.length;

                for (var y = 0; y < height; y++) {
                    boardData.push(new Array());
                    for (var x = 0; x < width; x++) {
                        boardData[y].push({value: CELL.NIL});
                    }
                }

                return {
                    boardData: boardData,
                    columnHints: {
                        col: board.columnHintData.map(function(col) {
                            return col.map(function(value) {
                                return { hint: value };
                            });
                        })
                    },
                    rowHints: {
                        row: board.rowHintData.map(function(row) {
                            return row.map(function(value) {
                                return { hint: value };
                            });
                        })
                    },
                    static: true
                };
            });
        });
    }


    // initialize all static boards
    allBoards = initAllBoards();
    // append saved boards to static boards
    loadSavedBoards();

    // todo should go to controller
    function setBoardSize() {
        var width = boardData[0].length, height = boardData.length;
        boardSize.x = width * 26 + Math.floor(width / 5) + rowHints.getMaxX() * 26 * 2;
        boardSize.y = height * 26 + Math.floor(height / 5) + columnHints.getMaxY() * 26 * 2;
        // console.log('board size '+boardSize.x+':'+boardSize.y);
    }

    function setBoardData(y, x, value) {
        undoData.addItem({
            y: y,
            x: x,
            was: boardData[y][x].value,
            is: value
        });
        return boardData[y][x].value = value;
    }

    var columnHints = {
        col: [],
        matching: [],
        maxCol: null, // todo: replace by ng-repeat-range
        getHint: function(x, y, side) {
            if (side === SIDE.TOP) {
                y -= this.getMaxY() - this.col[x].length;
            }
            return (y < 0) ? '' : (y < this.col[x].length) ? this.col[x][y].hint : '';
        },
        getMaxY: function() {
            var maxY = Math.floor((boardData.length + 1) / 2);
            return Math.min(this.getLongestColLength() + ((boardStatus === STATUS.SETUP) ? 1 : 0), maxY);
        },
        getLongestColLength: function() {
            return this.col.reduce(function(a, b) {
                return Math.max(a, b.length);
            }, 0);
        },
        setHint: function(x, y, side, value) {
            var result = {x: x, y: y};
            var last = false;

            if (side === SIDE.TOP) {
                y -= this.getMaxY() - this.col[x].length;
                if (y < 0) {
                    this.col[x].splice(0, 0, {hint: 0});
                    y = 0;
                }
                last = (!y);
                result.y = y + this.getMaxY() - this.col[x].length;
            } else {
                if (y >= this.col[x].length) {
                    this.col[x].push({hint: 0});
                    y = this.col[x].length-1;
                }
                last = (y === this.col[x].length-1);
                result.y = y;
            }

            if (value) {
                this.col[x][y].hint = parseInt(value);
                console.log('columnHints[' + x + ',' + y + ']=' + this.col[x][y].hint);
            } else if (last) {
                this.col[x].splice(y, 1);
            }
            setBoardSize();

            return result;
        },
        checkCol: function(x) {
            var chainLength = 0, hintIndex = 0, match = true;
            var boardHeight = boardData.length, hintCol = this.col[x], hintSize = hintCol.length;

            for (var y = 0; match && y < boardHeight; y++) {
                if (boardData[y][x].value === CELL.ON) {
                    chainLength++;
                    if (y === boardHeight-1 || boardData[y+1][x].value !== CELL.ON) {
                        match = (hintIndex < hintSize && hintCol[hintIndex].hint === chainLength);
                        hintIndex++;
                    }
                } else {
                    chainLength = 0;
                }
            }
            this.matching[x] = match && (hintIndex === hintSize);
        },
        allColsMatch: function(check) {
            var matching = true;
            for (var x = 0; x < this.matching.length; x++) {
                if (check) this.checkCol(x);
                matching = matching && this.matching[x];
            }
            return matching;
        },
        // try to solve the board column based on the hint values
        solveCol: function(x) {
            var self = this;
            var dataLength = boardData.length; // height
            var hintLength = self.col[x].length;

            /*
            This variable holds one particular variant of all pieces that can be
            allocated in column "x" according to its hint. The veriable represents
            an array of pairs: { piece start index; piece end index }.
            When building various variants this variable gets initially populated
            with the first variant and then gets updated to match the next variant.
            */
            var variant = Array(hintLength);

            /*
            This variable holds the common result after applying all variants.
            All cells that stay on or off across all variants will be on or off
            in the solution.
            */
            var solution = Array(dataLength);

            /*
            Tries to build a valid variant by starting with the hint [startIndex]
            and placing the first piece into the column at [offset]. Then places
            all remaining pieces according to the next hints to the next possible
            places.
            Returns "true" if could build a valid variant and "false" if not.
            buildVariant(0, 0) builds the first possible variant for all hints.
            */
            function buildVariant(startIndex, offset) {
                for (var index = startIndex; index < hintLength; index++) {
                    var piece = {
                        start: offset,
                        end: offset + self.col[x][index].hint - 1
                    };
                    // if the piece goes beyond column limit, the building is not possible
                    if (piece.end >= dataLength) return false;
                    variant[index] = piece;
                    // next piece should start by skipping 1 cell after this one
                    offset = piece.end + 2;
                }
                // all pieces are built successfully
                return true;
            }

            /*
            Tries to build the next variant based on the current state of <variant>
            variable. Tries to shift the last piece forfward, then second last and
            so on as long as the variant remains valid.
            If <variant> variable is not initialized, tries to build the first one.
            Returns "true" if could build a valid variant and "false" if not.
            */
            function buildNextVariant() {
                // if not initialized, build the first variant
                if (!variant[0]) {
                    return buildVariant(0, 0);
                }
                // try to shift a piece one cell forward starting with the last one
                for (var index = hintLength - 1; index >= 0; index--) {
                    if (buildVariant(index, variant[index].start + 1)) return true;
                }
                // all pieces are shifted to their last position - cannot build a new variant
                return false;
            }

            /*
            Checks if <variant> conflicts with any column cells set to on/off.
            Returns "true" if conflict found and "false" if not.
            */
            function variantConflictsWithBoard() {
                var index = 0, conflict = false;
                for (var y = 0; y < dataLength && !conflict; y++) {
                    if (index >= hintLength || y < variant[index].start) {
                        // check conflict with cells outside of variant pieces
                        conflict = (boardData[y][x].value === CELL.ON);
                    } else if (y <= variant[index].end) {
                        // check conflict with cells inside the variant pieces
                        conflict = (boardData[y][x].value == CELL.OFF);
                        // moving to the next piece
                        if (y === variant[index].end) {
                            index++;
                        }
                    }
                }
                //console.log(variant.map(function(item){
                //    return item.start+':'+item.end;
                //}) + ' - ' + (conflict ? 'conflict' : 'OK'));

                return conflict;
            }

            /*
            Applies <variant> to <solution>. All cells that stay on or off across
            all variants will be set to on or off in the solution.
            */
            function applyVariantToSolution() {
                var index = 0;
                for (var y = 0; y < dataLength; y++) {
                    if (index >= hintLength || y < variant[index].start) {
                        // apply to cells outside of variant pieces
                        solution[y] = (solution[y] === undefined || solution[y] === CELL.OFF) ? CELL.OFF : CELL.NIL;
                    } else if (y <= variant[index].end) {
                        // apply to cells inside the variant pieces
                        solution[y] = (solution[y] === undefined || solution[y] === CELL.ON) ? CELL.ON : CELL.NIL;
                        // moving to the next piece
                        if (y === variant[index].end) {
                            index++;
                        }
                    }
                }
                //console.log('Solution: ' + solution);
            }

            /*
            Applies <solution> to the board column.
            Copies only the cells set to on or off.
            */
            function applySolutionToBoard() {
                undoData.startBlock();
                for (var y = 0; y < dataLength; y++) {
                    if (solution[y] === CELL.OFF || solution[y] === CELL.ON) {
                        setBoardData(y, x, solution[y]);
                        rowHints.checkRow(y);
                    }
                }
                undoData.endBlock();
                self.checkCol(x);
                checkGame(false);
            }

            // main algorithm (self explanatory)
            while (buildNextVariant()) {
                if (!variantConflictsWithBoard()) {
                    applyVariantToSolution();
                }
            }
            applySolutionToBoard();
        },
        reset: function() {
            this.matching = new Array(this.col.length);
        }
    };
    var rowHints = {
        row: [],
        maxRow: null, // todo: replace by ng-repeat-range
        getHint: function(y, x, side) {
            if (side === SIDE.LEFT) {
                x -= this.getMaxX() - this.row[y].length;
            }
            return (x < 0) ? '' : (x < this.row[y].length) ? this.row[y][x].hint : '';
        },
        getMaxX: function() {
            var maxX = Math.floor((boardData[0].length + 1) / 2);
            return Math.min(this.getLongestRowLength() + ((boardStatus === STATUS.SETUP) ? 1 : 0), maxX);
        },
        getLongestRowLength: function() {
            return this.row.reduce(function(a, b) {
                return Math.max(a, b.length);
            }, 0);
        },
        setHint: function(y, x, side, value) {
            var result = {x: x, y: y};
            var last = false;

            if (side === SIDE.LEFT) {
                x -= this.getMaxX() - this.row[y].length;
                if (x < 0) {
                    this.row[y].splice(0, 0, {hint: 0});
                    x = 0;
                }
                last = (!x);
                result.x = x + this.getMaxX() - this.row[y].length;
            } else {
                if (x >= this.row[y].length) {
                    this.row[y].push({hint: 0});
                    x = this.row[y].length-1;
                }
                last = (x === this.row[y].length-1);
                result.x = x;
            }

            if (value) {
                this.row[y][x].hint = parseInt(value);
                console.log('rowHints[' + x + ',' + y + ']=' + this.row[y][x].hint);
            } else if (last) {
                this.row[y].splice(x, 1);
            }
            setBoardSize();

            return result;
        },
        checkRow: function(y) {
            var chainLength = 0, hintIndex = 0, match = true;
            var boardWidth = boardData[0].length, hintRow = this.row[y], hintSize = hintRow.length;

            for (var x = 0; match && x < boardWidth; x++) {
                if (boardData[y][x].value === CELL.ON) {
                    chainLength++;
                    if (x === boardWidth-1 || boardData[y][x+1].value !== CELL.ON) {
                        match = (hintIndex < hintSize && hintRow[hintIndex].hint === chainLength);
                        hintIndex++;
                    }
                } else {
                    chainLength = 0;
                }
            }
            this.matching[y] = match && (hintIndex === hintSize);
        },
        allRowsMatch: function(check) {
            var matching = true;
            for (var y = 0; y < this.matching.length; y++) {
                if (check) this.checkRow(y);
                matching = matching && this.matching[y];
            }
            return matching;
        },
        // try to solve the board row based on the hint values
        solveRow: function(y) {
            var self = this;
            var dataLength = boardData[0].length; // width
            var hintLength = self.row[y].length;
            var variant = Array(hintLength);
            var solution = Array(dataLength);

            function buildVariant(startIndex, offset) {
                for (var index = startIndex; index < hintLength; index++) {
                    var piece = {
                        start: offset,
                        end: offset + self.row[y][index].hint - 1
                    };
                    if (piece.end >= dataLength) return false;
                    variant[index] = piece;
                    offset = piece.end + 2;
                }
                return true;
            }

            function buildNextVariant() {
                if (!variant[0]) {
                    return buildVariant(0, 0);
                }
                for (var index = hintLength - 1; index >= 0; index--) {
                    if (buildVariant(index, variant[index].start + 1)) return true;
                }
                return false;
            }

            function variantConflictsWithBoard() {
                var index = 0, conflict = false;
                for (var x = 0; x < dataLength && !conflict; x++) {
                    if (index >= hintLength || x < variant[index].start) {
                        conflict = (boardData[y][x].value === CELL.ON);
                    } else if (x <= variant[index].end) {
                        conflict = (boardData[y][x].value == CELL.OFF);
                        if (x === variant[index].end) {
                            index++;
                        }
                    }
                }
                //console.log(variant.map(function(item){
                //    return item.start+':'+item.end;
                //}) + ' - ' + (conflict ? 'conflict' : 'OK'));

                return conflict;
            }

            function applyVariantToSolution() {
                var index = 0;
                for (var x = 0; x < dataLength; x++) {
                    if (index >= hintLength || x < variant[index].start) {
                        solution[x] = (solution[x] === undefined || solution[x] === CELL.OFF) ? CELL.OFF : CELL.NIL;
                    } else if (x <= variant[index].end) {
                        solution[x] = (solution[x] === undefined || solution[x] === CELL.ON) ? CELL.ON : CELL.NIL;
                        if (x === variant[index].end) {
                            index++;
                        }
                    }
                }
                //console.log('Solution: ' + solution);
            }

            function applySolutionToBoard() {
                undoData.startBlock();
                for (var x = 0; x < dataLength; x++) {
                    if (solution[x] === CELL.OFF || solution[x] === CELL.ON) {
                        setBoardData(y, x, solution[x]);
                        columnHints.checkCol(x);
                    }
                }
                undoData.endBlock();
                self.checkRow(y);
                checkGame(false);
            }

            // main algorithm (self explanatory)
            while (buildNextVariant()) {
                if (!variantConflictsWithBoard()) {
                    applyVariantToSolution();
                }
            }
            applySolutionToBoard();
        },
        reset: function() {
            this.matching = new Array(this.row.length);
        }
    };

    var undoData = {
        list: [],
        index: 0,

        reset: function() {
            this.list = [];
            this.index = 0;
        },
        getCurrentItem: function() {
            return (this.index < this.list.length) ? this.list[this.index] : false;
        },
        setCurrentItem: function(value) {
            if (this.index < this.list.length) {
                this.list[this.index] = value;
            } else {
                this.list.push(value);
            }
        },
        startBlock: function() {
            this.setCurrentItem([]);
        },
        endBlock: function() {
            var current = this.getCurrentItem();
            if (current.length) {
                this.index++;
                console.log('undo block (' + current.length + ') added, list(' + this.list.length + '), index: ' + this.index);
            } else {
                this.list.splice(this.index, 1);
                console.log('undo block canceled, list(' + this.list.length + '), index: ' + this.index);
            }
        },
        addItem: function(item) {
            var current = this.getCurrentItem();
            if (angular.isArray(current)) {
                current.push(item);
            } else {
                this.list.splice(this.index, this.list.length);
                this.list.push(item);
                this.index++;
                console.log('undo item added, list(' + this.list.length + '), index: ' + this.index);
            }
        },
        canUndo: function() {
            return (this.index > 0);
        },
        undo: function() {
            function doUndo(item) {
                boardData[item.y][item.x].value = item.was;
            }

            this.index--;
            var current = this.getCurrentItem();

            if (angular.isArray(current)) {
                for (var i = 0; i < current.length; i++) {
                    doUndo(current[i]);
                }
                console.log('block undone, list(' + this.list.length + '), index: ' + this.index);
            } else {
                doUndo(current);
                console.log('item undone, list(' + this.list.length + '), index: ' + this.index);
            }
        },
        canRedo: function() {
            return (this.index < this.list.length);
        },
        redo: function() {
            function doRedo(item) {
                boardData[item.y][item.x].value = item.is;
            }

            var current = this.getCurrentItem();
            this.index++;

            if (angular.isArray(current)) {
                for (var i = 0; i < current.length; i++) {
                    doRedo(current[i]);
                }
                console.log('block redone, list(' + this.list.length + '), index: ' + this.index);
            } else {
                doRedo(current);
                console.log('item redone, list(' + this.list.length + '), index: ' + this.index);
            }
        }
    };

    function checkGame(check) {
        if (boardStatus === STATUS.GAME) {
            var allColsMatch = columnHints.allColsMatch(check);
            var allRowsMatch = rowHints.allRowsMatch(check);
            if (allColsMatch && allRowsMatch) {
                boardStatus = STATUS.OVER;
                sourceBoard.solved = true;
                console.log('Game solved!');
            }
        }
    }

    return {
        allBoards: function() {
            return allBoards;
        },
        savedBoards: function() {
            return savedBoards;
        },
        boardData: function() {
            return boardData;
        },
        boardIndex: function() {
            return boardIndex;
        },
        boardSize: function() {
            return boardSize;
        },
        columnHints: function() {
            return columnHints;
        },
        rowHints: function() {
            return rowHints;
        },
        undoData: function() {
            return undoData;
        },
        boardStatus: function() {
            return boardStatus;
        },
        resetBoard: function(width, height) {
            boardData.splice(0, boardData.length);
            for (var y = 0; y < height; y++) {
                boardData.push(new Array());
                for (var x = 0; x < width; x++) {
                    boardData[y].push({value: CELL.NIL});
                }
            }
            columnHints.reset();
            rowHints.reset();
            undoData.reset();
            sourceBoard.solved = false;
            if (boardStatus != STATUS.SETUP) {
                boardStatus = STATUS.GAME;
            }
        },
        initWithSize: function(width, height, status) {
            boardData = [];
            boardIndex = savedBoards.length;
            boardStatus = status;

            columnHints.col = new Array(width);
            columnHints.maxCol = Array(height);
            for (var x = 0; x < columnHints.col.length; x++) {
                columnHints.col[x] = [];
            }

            rowHints.row = new Array(height);
            rowHints.maxRow = Array(width);
            for (var y = 0; y < rowHints.row.length; y++) {
                rowHints.row[y] = [];
            }
            this.resetBoard(width, height);
            setBoardSize();
        },
        initFromSaved: function(board, status) {
            sourceBoard = board;
            boardData = board.boardData;
            var width = boardData[0].length, height = boardData.length;
            boardIndex = savedBoards.indexOf(board);
            boardStatus = status;
            columnHints.col = board.columnHints.col;
            columnHints.matching = new Array(width);
            columnHints.maxCol = Array(height);
            rowHints.row = board.rowHints.row;
            rowHints.matching = new Array(height);
            rowHints.maxRow = Array(width);
            setBoardSize();
            checkGame(true);
        },
        checkBoard: checkGame,
        setBoardXY: function(x, y, value) {
            setBoardData(y, x, value);
            columnHints.checkCol(x);
            rowHints.checkRow(y);
            checkGame(false);
        },
        saveCurrentBoard: function() {
            var board = {
                boardData: boardData,
                columnHints: columnHints,
                rowHints: rowHints
            };
            LocalStorage.setObject(BOARDKEY.concat(boardIndex), board);
            if (boardIndex < savedBoards.length) {
                savedBoards[boardIndex] = board;
            } else {
                savedBoards.push(board);
            }
        },
        deleteCurrentBoard: function() {
            for (var i = boardIndex + 1; i < savedBoards.length; i++) {
                if (!savedBoards[i].static) {
                    LocalStorage.setObject(BOARDKEY.concat(i-1), savedBoards[i]);
                }
            }
            LocalStorage.delete(BOARDKEY.concat(savedBoards.length-1));
            savedBoards.splice(boardIndex, 1);
        }
    };
})

;
