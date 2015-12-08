angular.module('crossbits.controllers', [])

.controller ('AppCtrl', function($scope, $ionicPopup, $timeout) {

    $scope.confirmPopup = function(title, cancelText, okText, action) {
        $ionicPopup.confirm({
            title: title,
            cssClass: 'popup-dark',
            cancelText: cancelText,
            cancelType: 'button-dark',
            okText: okText,
            okType: 'button-assertive'
        }).then(action);
    };

    $scope.infoPopup = function(title, action, delay) {
        var popup = $ionicPopup.show({
            title: '<i class="icon ion-checkmark"></i> ' + title
        });
        $timeout(function() {
            popup.close();
            if (action) action();
        }, delay || 500);
    };
})


.controller('MainCtrl', function($scope, Game) {
    $scope.savedBoards = Game.savedBoards();
})


.controller('NewGameCtrl', function($scope, $state, Game) {
    $scope.size = {
        _x: 5,
        x: function(v) {
            if (v !== undefined) {
                this._x = parseInt(v);
                if (this.locked) this._y = this._x;
            }
            return this._x;
        },
        _y: 5,
        y: function(v) {
            if (v !== undefined) {
                this._y = parseInt(v);
                if (this.locked) this._x = this._y;
            }
            return this._y;
        },
        locked: true,
        toggleLocked: function() {
            this.locked = !this.locked;
            if (this.locked) this._y = this._x;
        },
        minX: 5, minY: 5,
        maxX: 50, maxY: 50,
        incX: function(d) { this.x(this._x + d) },
        incY: function(d) { this.y(this._y + d) },
        canIncX: function(d) {
            d += this._x;
            return (d <= this.maxX) && (d >= this.minX);
        },
        canIncY: function(d) {
            d += this._y;
            return (d <= this.maxY) && (d >= this.minY);
        }
    };

    $scope.editBoard = function() {
        Game.initWithSize($scope.size._x, $scope.size._y, STATUS_SETUP);
        $state.go("game");
    }
})


.controller('LoadGameCtrl', function($scope, $state, Game, $ionicSlideBoxDelegate) {

    $scope.savedBoards = Game.savedBoards();

    $scope.loadGame = function(board) {
        Game.initFromSaved(board, STATUS_GAME);
        $state.go("game");
    };

    $scope.editCurrentBoard = function() {
        var board = $scope.savedBoards[$ionicSlideBoxDelegate.currentIndex()];
        Game.initFromSaved(board, STATUS_SETUP);
        $state.go("game");
    };
})


.controller('BoardCtrl', function($scope, $ionicHistory, $ionicGesture, $ionicPopup, Game, $ionicScrollDelegate) {

    $scope.boardData = Game.boardData();
    $scope.boardSize = Game.boardSize();
    $scope.columnHints = Game.columnHints();
    $scope.rowHints = Game.rowHints();

    $scope.dragObj = null;

    function boardXY(div) {
        var attrX = div.attributes["x"], attrY = div.attributes["y"];
        if (attrX && attrY) {
            return {
                x: parseInt(attrX.value),
                y: parseInt(attrY.value)
            }
        } else {
            return false;
        }
    }
    function nextCellValue(value) {
        return (value === CELL_ON) ? CELL_OFF : (value === CELL_OFF) ? CELL_NIL : CELL_ON;
    }

    function toggleCell(div) {
        var xy = boardXY(div);
        if (xy) {
            var value = $scope.boardData[xy.y][xy.x].value;
            Game.setBoardData(xy.y, xy.x, nextCellValue(value));
            $scope.columnHints.checkCol(xy.x);
            $scope.rowHints.checkRow(xy.y);
        }
    }

    function setCellsAtoB(A, B, value) {
        var dx = (B.x === A.x) ? 0 : (B.x > A.x) ? 1 : -1;
        var dy = (B.y === A.y) ? 0 : (B.y > A.y) ? 1 : -1;
        if (dx || dy) {
            Game.undoData().startBlock();
            for (var x = A.x, y = A.y; (dx === 0 || x !== B.x + dx) && (dy === 0 || y !== B.y + dy); x += dx, y += dy) {
                Game.setBoardData(y, x, value);
                $scope.columnHints.checkCol(x);
                $scope.rowHints.checkRow(y);
            }
            Game.undoData().endBlock();
        }
    }

    var boardElement = angular.element(document.querySelector("#board"));

    $ionicGesture.on('tap', function(e) {
        $scope.$apply(function() {
            var attrKind = e.target.attributes["kind"];
            var attrX = e.target.attributes["x"];
            var attrY = e.target.attributes["y"];

            if (attrKind && attrX && attrY) {
                if ($scope.isSetup()) {
                    // tap handling in setup mode
                    switch (attrKind.value) {
                        case 'tophint':
                            $scope.editColumnHint(attrX.value, attrY.value, 'T');
                            break;
                        case 'bottomhint':
                            $scope.editColumnHint(attrX.value, attrY.value, 'B');
                            break;
                        case 'lefthint':
                            $scope.editRowHint(attrY.value, attrX.value, 'L');
                            break;
                        case 'righthint':
                            $scope.editRowHint(attrY.value, attrX.value, 'R');
                            break;
                    }
                } else /* !$scope.isSetup() */ {
                    // tap handling in game mode
                    switch (attrKind.value) {
                        case 'tophint':
                        case 'bottomhint':
                            $scope.solveColumn(attrX.value);
                            break;
                        case 'lefthint':
                        case 'righthint':
                            $scope.solveRow(attrY.value);
                            break;
                        case 'data':
                            toggleCell(e.target);
                            break;
                    }
                }
            }
        });
    }, boardElement);

    $ionicGesture.on('touch', function(e) {
        $scope.$apply(function() {
            var attrKind = e.target.attributes["kind"];
            // only single touch draws a line
            if (!$scope.isSetup() && attrKind && attrKind.value === 'data' && e.gesture.touches.length === 1) {
                var xy = boardXY(e.target);
                $scope.dragObj = {
                    start: xy,
                    current: xy,
                    value: nextCellValue($scope.boardData[xy.y][xy.x].value),
                    orientation: null
                };
            } else {
                $scope.dragObj = null;
            }
        });
    }, boardElement);

    $ionicGesture.on('drag', function(e) {
        $scope.$apply(function() {
            var attrKind = e.target.attributes["kind"];
            if (!$scope.isSetup() && attrKind && attrKind.value === 'data' && $scope.dragObj) {
                var touch = e.gesture.touches[0];
                var xy = boardXY(document.elementFromPoint(touch.clientX, touch.clientY));
                var firstDrag = false;

                // determine the dragging orientation
                if (xy && !$scope.dragObj.orientation) {
                    if (xy.x !== $scope.dragObj.start.x) {
                        $scope.dragObj.orientation = 'X';
                        firstDrag = true;
                    } else if (xy.y !== $scope.dragObj.start.y) {
                        $scope.dragObj.orientation = 'Y';
                        firstDrag = true;
                    }
                }

                // set all cells based on the 1st accoring to the dragging orientation
                if (xy && $scope.dragObj.orientation === 'X' && xy.x !== $scope.dragObj.current.x) {
                    // horizontal orientation - resetting y-coord
                    xy.y = $scope.dragObj.start.y;
                    $scope.dragObj.current = xy;
                    if (!firstDrag) {
                        $scope.undo();
                    }
                    if (xy.x !== $scope.dragObj.start.x) {
                        setCellsAtoB(xy, $scope.dragObj.start, $scope.dragObj.value);
                    } else {
                        $scope.dragObj.orientation = null;
                    }
                }
                else if (xy && $scope.dragObj.orientation === 'Y' && xy.y !== $scope.dragObj.current.y) {
                    // vertical orientation - resetting x-coord
                    xy.x = $scope.dragObj.start.x;
                    $scope.dragObj.current = xy;
                    if (!firstDrag) {
                        $scope.undo();
                    }
                    if (xy.y !== $scope.dragObj.start.y) {
                        setCellsAtoB(xy, $scope.dragObj.start, $scope.dragObj.value);
                    } else {
                        $scope.dragObj.orientation = null;
                    }

                }
            }
        });
    }, boardElement);

    $scope.$on('$ionicView.beforeEnter',function() {
        var initZoomX = window.innerWidth / $scope.boardSize.x;
        var initZoomY = window.innerHeight / $scope.boardSize.y;
        var zoom = Math.min(initZoomX, initZoomY, 1.5);
        $ionicScrollDelegate.$getByHandle('boardScroll').zoomBy(zoom, false, 0);
        console.log('Zoom ' + zoom);
    });

    $scope.isSetup = function() {
        return (Game.boardStatus() === STATUS_SETUP);
    };

    $scope.isNewBoard = function() {
        return (Game.boardIndex() >= Game.savedBoards().length);
    };

    $scope.editColumnHint = function(x, y, side) {
        var value = prompt("Enter hint ["+x+","+y+"]", $scope.columnHints.getHint(x, y, side));
        $scope.columnHints.setHint(x, y, side, value);
    };

    $scope.editRowHint = function(y, x, side) {
        var value = prompt("Enter hint ["+x+","+y+"]", $scope.rowHints.getHint(y, x, side));
        $scope.rowHints.setHint(y, x, side, value);
    };

    $scope.solveColumn = function(x) {
        $scope.columnHints.solveCol(x);
    };

    $scope.solveRow = function(y) {
        $scope.rowHints.solveRow(y);
    };

    $scope.save = function() {
        Game.saveCurrentBoard();
        $scope.infoPopup('Saved', function() {
            $ionicHistory.goBack(-2);
        });
    };

    $scope.delete = function() {
        $scope.confirmPopup('Delete this board?', 'Keep', 'Delete', function(result) {
            if (result) {
                Game.deleteCurrentBoard();
                $ionicHistory.goBack(-2);
            }
        });
    };

    $scope.canUndo = function() {
        return Game.undoData().canUndo();
    };

    $scope.canRedo = function() {
        return Game.undoData().canRedo();
    };

    $scope.clear = function() {
        $scope.confirmPopup('Clear this board?', 'No', 'Yes', function(result) {
            if (result) {
                Game.resetBoard($scope.boardData[0].length, $scope.boardData.length);
            }
        });
    };

    $scope.undo = function() {
        Game.undoData().undo();
    };

    $scope.redo = function() {
        Game.undoData().redo();
    };

});
