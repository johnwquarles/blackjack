"use strict";

var API_URL = "http://deckofcardsapi.com/api";
var API_PROXY = "https://jsonp.afeld.me/?url=";
var game;
var CARD_BACK_URL = "images/back.png";
var $DEALERHAND = $(".dealer-hand");
var $PLAYERHAND = $(".player-hand");
var $PLAYERCONTROLS = $(".player-controls");
var $DEALERMSG = $(".dealer-msg");
var $PLAYERMSG = $(".player-msg");
var $PLAYERWRAPPER = $(".player-wrapper");
var $MSGAREA = $(".msg-area");
var clicksOn = false;
var message_events = [];
var cardflip_events = [];
var event_array = [];

// time between messages written to the "board" when the game concludes.
var MSG_STAGGER = 600;

// time between dealer's card flips upon a game over.
var DEALER_CASCADE_FLIP_TIME = 120;

// time between dealer's individual turns
var DEALER_TURN_DELAY = 1500;

// time between each individual card flip
// for the player's cards after each new card added (2 in the beginning)
// and for the flip of the dealer's first card.
// (which is currently flipped after the dealer's *second* card is shown.
var CASCADE_FLIP_TIME = 400;

startGame();

// to start off the game, make a new game object (with attributes that will preserve the game's state, ie, who has what cards) and then
// ask the API for a deck ID to assign to the game object's deck (we need to use it for subsequent calls to the API, when we ask it for cards from
// our deck).
// We can't do anything until we have that deck ID, but the program would happily continue on prior to actually loading the object that contains the
// deck ID. So we need a way to make it wait until that object has successfully loaded-- we do so by making the next step in the program, which
// is the dealer's initial turn, fire as part of the setDeckID function's callback function. That way it won't happen until it has the requisite data.
function startGame() {
  game = new Game();
  clearMessages();
  $PLAYERCONTROLS.empty();
  $DEALERHAND.empty();
  $PLAYERHAND.empty();
  $MSGAREA.empty();
  setDeckId(playerInitialTurn);
  if (clicksOn === false) {
    setClickHandlers();
  }
}

// setting up a game object to preserve the game's state. This is a constructor function that is invoked above via "game = new Game();" to
// generate a game object with all of the attributes listed below.
function Game() {
  this.deck_id = "";
  this.dealer_cards = [];
  this.player_cards = [];
  this.playertotal = 0;
  this.dealertotal = 0;
  this.playerturn = 0;
  this.playerblackjack = false;
}

function setClickHandlers() {
  $PLAYERWRAPPER.on("click", ".hit-btn", function (event) {
    event.preventDefault();
    event_array.push(event);
    $PLAYERWRAPPER.off("click");
    clicksOn = false;
    if (game.playertotal < 21) {
      dealCards("player", 1, playerLoop);
    }
  }).on("click", ".stick-btn", function (event) {
    event.preventDefault();
    event_array.push(event);
    $PLAYERCONTROLS.empty();
    dealerInitialTurn();
  }).on("click", ".newgame", function (event) {
    event.preventDefault();
    event_array.push(event);
    $PLAYERCONTROLS.empty();
    startGame();
  });
  clicksOn = true;
}

// set the the game object's deck_id by calling the API and looking at the deck_id attribute of the response it gives us.
// After the data has loaded (and written to the game object), our callback function fires off, which we've set up to be whatever function we pass in.
// We pass in playerInitialTurn (line 44) so that the game starts.

function setDeckId(callback) {
  $.get(API_PROXY + API_URL + "/shuffle/?deck_count=6", function (obj) {
    game.deck_id = obj.deck_id;
    callback();
  }, "json");
}

// specify "player" or "dealer" and how many cards. Their array will be populated with the cards (via array concatenation)
// and the total updated (will make Aces worth
// 1 instead of 11 if it will prevent busting; see subsequent functions for details on how this happens.
// http://deckofcardsapi.com/ shows what the response object looks like; check under "draw a card".
function dealCards(towhom, num, callback) {
  var get_url = API_PROXY + API_URL + "/draw/" + game.deck_id + "/?count=" + num;
  $.get(get_url, function (obj) {
    if (towhom.toLowerCase() === "player") {
      if (game.playertotal < 22) {
        game.player_cards = game.player_cards.concat(obj.cards);
        insertPlayerCards(obj.cards);
        updateTotal("player");
      }
      if (game.playertotal > 21 && !$(".newgame").length) {
        $PLAYERWRAPPER.off("click");
        clicksOn = false;
      }
    } else {
      game.dealer_cards = game.dealer_cards.concat(obj.cards);
      insertDealerCards(obj.cards);
      updateTotal("dealer");
    }
    callback();
  }, "json");
}

// enter "player" or "dealer". It will sum up the total of the cards,
// with aces moved to the back so that the computer can decide to count them as
// 1 if it will prevent busting. The new total is written to the game object. This doesn't modify the original
// card order; don't want to do that, because we want to keep the order for display purposes.
// so doing .slice() on the card arrays will let us make the acesToBack-ed arrays from copies.
function updateTotal(whom) {
  var cards = whom.toLowerCase() === "player" ? game.player_cards.slice() : game.dealer_cards.slice();
  var sum_array = acesToBack(cards);
  var aces_amt = sum_array.reduce(function (acc, card) {
    if (card.value === "ACE") {
      return acc + 1;
    } else {
      return acc;
    }
  }, 0);

  var total = sum_array.reduce(function (acc, card) {
    if (card.value === "KING" || card.value === "QUEEN" || card.value === "JACK") {
      return acc + 10;
    } else if (card.value === "ACE") {
      if (acc + 11 < 22) {
        return acc + 11;
      } else {
        return acc + 1;
      }
    } else {
      return acc + parseInt(card.value);
    }
  }, 0);

  if (total > 21 && aces_amt > 1) {
    var big_total = sum_array.reduce(function (acc, card) {
      if (card.value === "KING" || card.value === "QUEEN" || card.value === "JACK") {
        return acc + 10;
      } else if (card.value === "ACE") {
        return acc + 11;
      } else {
        return acc + parseInt(card.value);
      }
    }, 0);
    for (var i = 1; i <= aces_amt; i++) {
      if (big_total - 10 * i < 22) {
        total = big_total - 10 * i;
      }
    }
  }
  whom.toLowerCase() === "player" ? game.playertotal = total : game.dealertotal = total;
}

// aces to back of array for summation purposes.
// Look at all cards; ace? If so move it to the back. Not ace? Move it to the front.
function acesToBack(arr) {
  var return_arr = [];
  arr.forEach(function (card) {
    if (card.value === "ACE") {
      return_arr.push(card);
    } else {
      return_arr.unshift(card);
    }
  });
  return return_arr;
}

// Dealer's first turn. Deal 2 cards to the dealer, and after the data is loaded, invoke dealerLoop as the callback function.
// Note that the player actually goes first; code is in this order because I got that wrong at first.
function dealerInitialTurn() {
  dealCards("dealer", 2, dealerLoop);
}

// Make dealer's turns go slower (ie, not instantaneously) so that it feels like a card game is actually being played out;
// do so by setting a timeout on each subsequent function call (ie, each *next* dealer turn) that delays that next turn by
// DEALER_TURN_DELAY milliseconds; adjust this constant from the top of this file.
function dealerLoop() {
  if (game.dealertotal < 17) {
    setTimeout(function () {
      dealCards("dealer", 1, dealerLoop);
    }, DEALER_TURN_DELAY);
  } else {
    setTimeout(function () {
      dealerTurnResult();
    }, DEALER_TURN_DELAY);
  }
}

function make$P(string) {
  return $("<p>" + string + "</p>").addClass("animated fadeIn");
}

function dealerTurnResult() {
  if (game.dealertotal === 21 && game.dealer_cards.length === 2 && game.playerblackjack === false) {
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash"));
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P(" Dealer wins!").addClass("lose"));
    }, MSG_STAGGER));
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else if (game.dealertotal === 21 && game.dealer_cards.length === 2 && game.playerblackjack === true) {
    $MSGAREA.append(make$P("Double-blackjack!").removeClass("fadeIn").addClass("flash"));
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P("Push!"));
    }, MSG_STAGGER));
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else if (game.playerblackjack === true) {
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash"));
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P(" You win!").addClass("win"));
    }, MSG_STAGGER));
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else if (game.dealertotal > 21) {
    $MSGAREA.append(make$P("Dealer busts!"));
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P(" You win!").addClass("win"));
    }, MSG_STAGGER));
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else {
    finalReckoning();
  }
}

function playerInitialTurn() {
  dealCards("player", 2, playerLoop);
}

function playerLoop() {
  game.playerturn += 1;
  flipPlayerCards();
  if (game.playertotal === 21 && game.playerturn === 1) {
    game.playerblackjack = true;
    appendControlsAndWait();
  } else if (game.playertotal < 22) {
    appendControlsAndWait();
  }
}

function clearClicks() {
  event_array.forEach(function (event) {
    clearTimeout(event);
  });
}

function playerBusts() {
  clearClicks();
  $PLAYERCONTROLS.empty();
  $MSGAREA.append(make$P("You busted!").removeClass("fadeIn").addClass("swing"));
  message_events.push(setTimeout(function () {
    $MSGAREA.append(make$P(" You lose!").addClass("lose"));
  }, MSG_STAGGER));
  gameIsOverSoFlipAllCards();
  appendNewGameButton();
}

// if the neither the dealer nor the player won outright or busted during their respective turns, we need to compare the totals
// to see who won.
function finalReckoning() {
  $MSGAREA.append(make$P("Your total: " + game.playertotal).addClass("nomargin"));

  message_events.push(setTimeout(function () {
    $MSGAREA.append(make$P("Dealer's total: " + game.dealertotal).addClass("nomargin"));
  }, MSG_STAGGER));
  if (game.playertotal > game.dealertotal) {
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P("You win!").addClass("win").addClass("nomargin"));
    }, 2 * MSG_STAGGER));
    appendNewGameButton();
    gameIsOverSoFlipAllCards();
  } else if (game.playertotal === game.dealertotal) {
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P("Push!").addClass("nomargin"));
    }, 2 * MSG_STAGGER));
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else {
    message_events.push(setTimeout(function () {
      $MSGAREA.append(make$P("You lose!").addClass("lose").addClass("nomargin"));
    }, 2 * MSG_STAGGER));
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  }
}

function insertPlayerCards(card_arr) {
  card_arr.forEach(function (card_obj) {
    var $card = generateBack$IMG(card_obj);
    $PLAYERHAND.append($card);
  });
}

function generateFront$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS") {
    card_obj.image = "images/AceOfDiamonds.png";
  }
  var $card = $("<img src='" + card_obj.image + "'>");
  return $card;
}

function generateBack$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS") {
    card_obj.image = "images/AceOfDiamonds.png";
  }
  var $card = $("<img src='" + CARD_BACK_URL + "' front_url = '" + card_obj.image + "'>");
  return $card;
}

function insertDealerCards(card_arr) {
  card_arr.forEach(function (card_obj, i) {
    var $card = generateBack$IMG(card_obj);
    $DEALERHAND.append($card);
    if ($DEALERHAND.children().length === 2) {
      setTimeout(function () {
        $DEALERHAND.children()[0].src = $DEALERHAND.children()[0].getAttribute("front_url");
      }, CASCADE_FLIP_TIME);
    }
  });
}

// append controls and await player decision
function appendControlsAndWait() {
  $PLAYERCONTROLS.empty();
  if (game.playertotal !== 21) {
    var $hit = $("<button class='hit-btn'>Hit</button>");
    $PLAYERCONTROLS.append($hit);
  }
  var $stick = $("<button class='stick-btn'>Stand</button>");
  $PLAYERCONTROLS.append($stick);
}

function appendNewGameButton() {
  $PLAYERCONTROLS.empty();
  var $newgame = $("<button class='newgame'>New Game</button>");
  $PLAYERCONTROLS.append($newgame);
  if (clicksOn === false) {
    setClickHandlers();
  }
}

function flipDealerCards() {
  var img_arr = [].slice.call(document.querySelectorAll(".dealer-hand img"));
  // don't waste time checking the first card; it's already flipped for sure.
  var i = 1;
  var length = img_arr.length;
  function delayedFlip() {

    // This code will have all of dealer's cards flip at once upon a game over.

    // img_arr.forEach(function(img) {
    //   if (img.getAttribute("front_url")) {
    //     img.src = img.getAttribute("front_url");
    //   }
    // })

    // code below will make the dealer's cards all flip in a cascade
    // instead of all at once when the game ends.

    if (i < length) {
      //don't need the below check (if statement), as we're starting from the second card,
      // which has defintely not been flipped.
      //if (img_arr[i].getAttribute("front_url") !== img_arr[i].getAttribute("src")) {
      img_arr[i].src = img_arr[i].getAttribute("front_url");
      //}
      i += 1;
      setTimeout(function () {
        delayedFlip();
      }, DEALER_CASCADE_FLIP_TIME);
    }
  }
  setTimeout(function () {
    delayedFlip();
  }, DEALER_CASCADE_FLIP_TIME);
}

// Changed this up such that the game won't display all the "hey you busted" graphics until the last card has been flipped.
// Also had to use closure to ensure that the timeouts actually flip the card at index i according to what i was
// when the timeout was created (this is actually exactly like what Crockford talked about here:
// http://qdevdive.blogspot.com/2015/04/crockfords-concoction.html
function flipPlayerCards() {
  var img_arr = [].slice.call(document.querySelectorAll(".player-hand img"));
  var i = 0;
  var length = img_arr.length;
  function delayedFlip() {
    if (i < length) {
      if (img_arr[i].getAttribute("front_url") !== img_arr[i].getAttribute("src")) {
        var needThisForClosure = function (i) {
          var cardFlip = setTimeout(function () {
            img_arr[i].src = img_arr[i].getAttribute("front_url");
            if (game.playertotal > 21 && $MSGAREA.is(":empty")) {
              playerBusts();
              return;
            }
            if (clicksOn === false && game.playertotal < 22) {
              setClickHandlers();
            }
            delayedFlip();
          }, CASCADE_FLIP_TIME);
          cardflip_events.push(cardFlip);
        };

        needThisForClosure(i);
        i += 1;
        return;
      }
      i += 1;
      delayedFlip();
    }
  }
  delayedFlip();
}

function gameIsOverSoFlipAllCards() {
  flipDealerCards();
  cardflip_events.forEach(function (event) {
    clearTimeout(event);
  });
  var img_arr = [].slice.call(document.querySelectorAll(".player-hand img"));
  img_arr.forEach(function (card) {
    if (card.getAttribute("front_url") && card.getAttribute("front_url") !== card.getAttribute("src")) {
      card.src = card.getAttribute("front_url");
    }
  });
}

function clearMessages() {
  message_events.forEach(function (event) {
    clearTimeout(event);
  });
}
//# sourceMappingURL=data:application/json;base64,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Q0g7O0FBRUQsU0FBUyxhQUFhLEdBQUc7QUFDdkIsZ0JBQWMsQ0FBQyxPQUFPLENBQUMsVUFBUyxLQUFLLEVBQUU7QUFDckMsZ0JBQVksQ0FBQyxLQUFLLENBQUMsQ0FBQztHQUNyQixDQUFDLENBQUE7Q0FDSCIsImZpbGUiOiJzcmMvanMvbWFpbi5qcyIsInNvdXJjZXNDb250ZW50IjpbInZhciBBUElfVVJMID0gXCJodHRwOi8vZGVja29mY2FyZHNhcGkuY29tL2FwaVwiO1xudmFyIEFQSV9QUk9YWSA9IFwiaHR0cHM6Ly9qc29ucC5hZmVsZC5tZS8/dXJsPVwiO1xudmFyIGdhbWU7XG52YXIgQ0FSRF9CQUNLX1VSTCA9IFwiaW1hZ2VzL2JhY2sucG5nXCI7XG52YXIgJERFQUxFUkhBTkQgPSAkKCcuZGVhbGVyLWhhbmQnKTtcbnZhciAkUExBWUVSSEFORCA9ICQoJy5wbGF5ZXItaGFuZCcpO1xudmFyICRQTEFZRVJDT05UUk9MUyA9ICQoJy5wbGF5ZXItY29udHJvbHMnKTtcbnZhciAkREVBTEVSTVNHID0gJCgnLmRlYWxlci1tc2cnKTtcbnZhciAkUExBWUVSTVNHID0gJCgnLnBsYXllci1tc2cnKTtcbnZhciAkUExBWUVSV1JBUFBFUiA9ICQoJy5wbGF5ZXItd3JhcHBlcicpO1xudmFyICRNU0dBUkVBID0gJCgnLm1zZy1hcmVhJylcbnZhciBjbGlja3NPbiA9IGZhbHNlO1xudmFyIG1lc3NhZ2VfZXZlbnRzID0gW107XG52YXIgY2FyZGZsaXBfZXZlbnRzID0gW107XG52YXIgZXZlbnRfYXJyYXkgPSBbXTtcblxuLy8gdGltZSBiZXR3ZWVuIG1lc3NhZ2VzIHdyaXR0ZW4gdG8gdGhlIFwiYm9hcmRcIiB3aGVuIHRoZSBnYW1lIGNvbmNsdWRlcy5cbnZhciBNU0dfU1RBR0dFUiA9IDYwMDtcblxuLy8gdGltZSBiZXR3ZWVuIGRlYWxlcidzIGNhcmQgZmxpcHMgdXBvbiBhIGdhbWUgb3Zlci5cbnZhciBERUFMRVJfQ0FTQ0FERV9GTElQX1RJTUUgPSAxMjA7XG5cbi8vIHRpbWUgYmV0d2VlbiBkZWFsZXIncyBpbmRpdmlkdWFsIHR1cm5zXG52YXIgREVBTEVSX1RVUk5fREVMQVkgPSAxNTAwO1xuXG4vLyB0aW1lIGJldHdlZW4gZWFjaCBpbmRpdmlkdWFsIGNhcmQgZmxpcFxuLy8gZm9yIHRoZSBwbGF5ZXIncyBjYXJkcyBhZnRlciBlYWNoIG5ldyBjYXJkIGFkZGVkICgyIGluIHRoZSBiZWdpbm5pbmcpXG4vLyBhbmQgZm9yIHRoZSBmbGlwIG9mIHRoZSBkZWFsZXIncyBmaXJzdCBjYXJkLlxuLy8gKHdoaWNoIGlzIGN1cnJlbnRseSBmbGlwcGVkIGFmdGVyIHRoZSBkZWFsZXIncyAqc2Vjb25kKiBjYXJkIGlzIHNob3duLlxudmFyIENBU0NBREVfRkxJUF9USU1FID0gNDAwO1xuXG5zdGFydEdhbWUoKTtcblxuLy8gdG8gc3RhcnQgb2ZmIHRoZSBnYW1lLCBtYWtlIGEgbmV3IGdhbWUgb2JqZWN0ICh3aXRoIGF0dHJpYnV0ZXMgdGhhdCB3aWxsIHByZXNlcnZlIHRoZSBnYW1lJ3Mgc3RhdGUsIGllLCB3aG8gaGFzIHdoYXQgY2FyZHMpIGFuZCB0aGVuXG4vLyBhc2sgdGhlIEFQSSBmb3IgYSBkZWNrIElEIHRvIGFzc2lnbiB0byB0aGUgZ2FtZSBvYmplY3QncyBkZWNrICh3ZSBuZWVkIHRvIHVzZSBpdCBmb3Igc3Vic2VxdWVudCBjYWxscyB0byB0aGUgQVBJLCB3aGVuIHdlIGFzayBpdCBmb3IgY2FyZHMgZnJvbVxuLy8gb3VyIGRlY2spLlxuLy8gV2UgY2FuJ3QgZG8gYW55dGhpbmcgdW50aWwgd2UgaGF2ZSB0aGF0IGRlY2sgSUQsIGJ1dCB0aGUgcHJvZ3JhbSB3b3VsZCBoYXBwaWx5IGNvbnRpbnVlIG9uIHByaW9yIHRvIGFjdHVhbGx5IGxvYWRpbmcgdGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuLy8gZGVjayBJRC4gU28gd2UgbmVlZCBhIHdheSB0byBtYWtlIGl0IHdhaXQgdW50aWwgdGhhdCBvYmplY3QgaGFzIHN1Y2Nlc3NmdWxseSBsb2FkZWQtLSB3ZSBkbyBzbyBieSBtYWtpbmcgdGhlIG5leHQgc3RlcCBpbiB0aGUgcHJvZ3JhbSwgd2hpY2hcbi8vIGlzIHRoZSBkZWFsZXIncyBpbml0aWFsIHR1cm4sIGZpcmUgYXMgcGFydCBvZiB0aGUgc2V0RGVja0lEIGZ1bmN0aW9uJ3MgY2FsbGJhY2sgZnVuY3Rpb24uIFRoYXQgd2F5IGl0IHdvbid0IGhhcHBlbiB1bnRpbCBpdCBoYXMgdGhlIHJlcXVpc2l0ZSBkYXRhLlxuZnVuY3Rpb24gc3RhcnRHYW1lKCkge1xuICBnYW1lID0gbmV3IEdhbWUoKTtcbiAgY2xlYXJNZXNzYWdlcygpO1xuICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgJERFQUxFUkhBTkQuZW1wdHkoKTtcbiAgJFBMQVlFUkhBTkQuZW1wdHkoKTtcbiAgJE1TR0FSRUEuZW1wdHkoKTtcbiAgc2V0RGVja0lkKHBsYXllckluaXRpYWxUdXJuKTtcbiAgICBpZiAoY2xpY2tzT24gPT09IGZhbHNlKSB7XG4gICAgc2V0Q2xpY2tIYW5kbGVycygpO1xuICB9XG59XG5cbi8vIHNldHRpbmcgdXAgYSBnYW1lIG9iamVjdCB0byBwcmVzZXJ2ZSB0aGUgZ2FtZSdzIHN0YXRlLiBUaGlzIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gdGhhdCBpcyBpbnZva2VkIGFib3ZlIHZpYSBcImdhbWUgPSBuZXcgR2FtZSgpO1wiIHRvXG4vLyBnZW5lcmF0ZSBhIGdhbWUgb2JqZWN0IHdpdGggYWxsIG9mIHRoZSBhdHRyaWJ1dGVzIGxpc3RlZCBiZWxvdy5cbmZ1bmN0aW9uIEdhbWUoKSB7XG4gIHRoaXMuZGVja19pZCA9IFwiXCI7XG4gIHRoaXMuZGVhbGVyX2NhcmRzID0gW107XG4gIHRoaXMucGxheWVyX2NhcmRzID0gW107XG4gIHRoaXMucGxheWVydG90YWwgPSAwO1xuICB0aGlzLmRlYWxlcnRvdGFsID0gMDtcbiAgdGhpcy5wbGF5ZXJ0dXJuID0gMDtcbiAgdGhpcy5wbGF5ZXJibGFja2phY2sgPSBmYWxzZTtcbn1cblxuZnVuY3Rpb24gc2V0Q2xpY2tIYW5kbGVycygpIHtcbiAgJFBMQVlFUldSQVBQRVIub24oJ2NsaWNrJywgJy5oaXQtYnRuJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50X2FycmF5LnB1c2goZXZlbnQpO1xuICAgICRQTEFZRVJXUkFQUEVSLm9mZignY2xpY2snKTtcbiAgICBjbGlja3NPbiA9IGZhbHNlO1xuICAgIGlmIChnYW1lLnBsYXllcnRvdGFsIDwgMjEpIHtcbiAgICAgIGRlYWxDYXJkcyhcInBsYXllclwiLCAxLCBwbGF5ZXJMb29wKTtcbiAgICB9XG4gIH0pLm9uKCdjbGljaycsICcuc3RpY2stYnRuJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50X2FycmF5LnB1c2goZXZlbnQpO1xuICAgICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICAgIGRlYWxlckluaXRpYWxUdXJuKCk7XG4gIH0pLm9uKCdjbGljaycsICcubmV3Z2FtZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudF9hcnJheS5wdXNoKGV2ZW50KTtcbiAgICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgICBzdGFydEdhbWUoKTtcbiAgfSlcbiAgY2xpY2tzT24gPSB0cnVlO1xufVxuXG4vLyBzZXQgdGhlIHRoZSBnYW1lIG9iamVjdCdzIGRlY2tfaWQgYnkgY2FsbGluZyB0aGUgQVBJIGFuZCBsb29raW5nIGF0IHRoZSBkZWNrX2lkIGF0dHJpYnV0ZSBvZiB0aGUgcmVzcG9uc2UgaXQgZ2l2ZXMgdXMuXG4vLyBBZnRlciB0aGUgZGF0YSBoYXMgbG9hZGVkIChhbmQgd3JpdHRlbiB0byB0aGUgZ2FtZSBvYmplY3QpLCBvdXIgY2FsbGJhY2sgZnVuY3Rpb24gZmlyZXMgb2ZmLCB3aGljaCB3ZSd2ZSBzZXQgdXAgdG8gYmUgd2hhdGV2ZXIgZnVuY3Rpb24gd2UgcGFzcyBpbi5cbi8vIFdlIHBhc3MgaW4gcGxheWVySW5pdGlhbFR1cm4gKGxpbmUgNDQpIHNvIHRoYXQgdGhlIGdhbWUgc3RhcnRzLlxuXG5mdW5jdGlvbiBzZXREZWNrSWQoY2FsbGJhY2spIHtcbiAgJC5nZXQoQVBJX1BST1hZICsgQVBJX1VSTCArIFwiL3NodWZmbGUvP2RlY2tfY291bnQ9NlwiLCBmdW5jdGlvbihvYmope1xuICAgIGdhbWUuZGVja19pZCA9IG9iai5kZWNrX2lkO1xuICAgIGNhbGxiYWNrKCk7XG4gIH0sICdqc29uJyk7XG59XG5cbi8vIHNwZWNpZnkgXCJwbGF5ZXJcIiBvciBcImRlYWxlclwiIGFuZCBob3cgbWFueSBjYXJkcy4gVGhlaXIgYXJyYXkgd2lsbCBiZSBwb3B1bGF0ZWQgd2l0aCB0aGUgY2FyZHMgKHZpYSBhcnJheSBjb25jYXRlbmF0aW9uKVxuLy8gYW5kIHRoZSB0b3RhbCB1cGRhdGVkICh3aWxsIG1ha2UgQWNlcyB3b3J0aFxuLy8gMSBpbnN0ZWFkIG9mIDExIGlmIGl0IHdpbGwgcHJldmVudCBidXN0aW5nOyBzZWUgc3Vic2VxdWVudCBmdW5jdGlvbnMgZm9yIGRldGFpbHMgb24gaG93IHRoaXMgaGFwcGVucy5cbi8vIGh0dHA6Ly9kZWNrb2ZjYXJkc2FwaS5jb20vIHNob3dzIHdoYXQgdGhlIHJlc3BvbnNlIG9iamVjdCBsb29rcyBsaWtlOyBjaGVjayB1bmRlciBcImRyYXcgYSBjYXJkXCIuXG5mdW5jdGlvbiBkZWFsQ2FyZHModG93aG9tLCBudW0sIGNhbGxiYWNrKSB7XG4gIHZhciBnZXRfdXJsID0gQVBJX1BST1hZICsgQVBJX1VSTCArIFwiL2RyYXcvXCIgKyBnYW1lLmRlY2tfaWQgKyBcIi8/Y291bnQ9XCIgKyBudW07XG4gICQuZ2V0KGdldF91cmwsIGZ1bmN0aW9uKG9iail7XG4gICAgaWYgKHRvd2hvbS50b0xvd2VyQ2FzZSgpID09PSBcInBsYXllclwiKSB7XG4gICAgICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA8IDIyKSB7XG4gICAgICAgIGdhbWUucGxheWVyX2NhcmRzID0gZ2FtZS5wbGF5ZXJfY2FyZHMuY29uY2F0KG9iai5jYXJkcyk7XG4gICAgICAgIGluc2VydFBsYXllckNhcmRzKG9iai5jYXJkcyk7XG4gICAgICAgIHVwZGF0ZVRvdGFsKFwicGxheWVyXCIpO1xuICAgICAgfVxuICAgICAgaWYgKGdhbWUucGxheWVydG90YWwgPiAyMSAmJiAhKCQoXCIubmV3Z2FtZVwiKS5sZW5ndGgpKSB7XG4gICAgICAgICRQTEFZRVJXUkFQUEVSLm9mZignY2xpY2snKTtcbiAgICAgICAgY2xpY2tzT24gPSBmYWxzZTtcbiAgICAgIH1cbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBnYW1lLmRlYWxlcl9jYXJkcyA9IGdhbWUuZGVhbGVyX2NhcmRzLmNvbmNhdChvYmouY2FyZHMpO1xuICAgICAgaW5zZXJ0RGVhbGVyQ2FyZHMob2JqLmNhcmRzKTtcbiAgICAgIHVwZGF0ZVRvdGFsKFwiZGVhbGVyXCIpO1xuICAgIH1cbiAgICBjYWxsYmFjaygpO1xuICB9LCAnanNvbicpO1xufVxuXG4vLyBlbnRlciBcInBsYXllclwiIG9yIFwiZGVhbGVyXCIuIEl0IHdpbGwgc3VtIHVwIHRoZSB0b3RhbCBvZiB0aGUgY2FyZHMsXG4vLyB3aXRoIGFjZXMgbW92ZWQgdG8gdGhlIGJhY2sgc28gdGhhdCB0aGUgY29tcHV0ZXIgY2FuIGRlY2lkZSB0byBjb3VudCB0aGVtIGFzXG4vLyAxIGlmIGl0IHdpbGwgcHJldmVudCBidXN0aW5nLiBUaGUgbmV3IHRvdGFsIGlzIHdyaXR0ZW4gdG8gdGhlIGdhbWUgb2JqZWN0LiBUaGlzIGRvZXNuJ3QgbW9kaWZ5IHRoZSBvcmlnaW5hbFxuLy8gY2FyZCBvcmRlcjsgZG9uJ3Qgd2FudCB0byBkbyB0aGF0LCBiZWNhdXNlIHdlIHdhbnQgdG8ga2VlcCB0aGUgb3JkZXIgZm9yIGRpc3BsYXkgcHVycG9zZXMuXG4vLyBzbyBkb2luZyAuc2xpY2UoKSBvbiB0aGUgY2FyZCBhcnJheXMgd2lsbCBsZXQgdXMgbWFrZSB0aGUgYWNlc1RvQmFjay1lZCBhcnJheXMgZnJvbSBjb3BpZXMuXG5mdW5jdGlvbiB1cGRhdGVUb3RhbCh3aG9tKSB7XG4gIHZhciBjYXJkcyA9IHdob20udG9Mb3dlckNhc2UoKSA9PT0gXCJwbGF5ZXJcIiA/IGdhbWUucGxheWVyX2NhcmRzLnNsaWNlKCkgOiBnYW1lLmRlYWxlcl9jYXJkcy5zbGljZSgpO1xuICB2YXIgc3VtX2FycmF5ID0gYWNlc1RvQmFjayhjYXJkcyk7XG4gIHZhciBhY2VzX2FtdCA9IHN1bV9hcnJheS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjYXJkKSB7XG4gICAgaWYgKGNhcmQudmFsdWUgPT09IFwiQUNFXCIpIHtcbiAgICAgIHJldHVybiBhY2MgKyAxO1xuICAgIH1cbiAgICBlbHNlIHtyZXR1cm4gYWNjfVxuICB9LCAwKTtcblxuICB2YXIgdG90YWwgPSBzdW1fYXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY2FyZCkge1xuICAgIGlmIChjYXJkLnZhbHVlID09PSBcIktJTkdcIiB8fCBjYXJkLnZhbHVlID09PSBcIlFVRUVOXCIgfHwgY2FyZC52YWx1ZSA9PT0gXCJKQUNLXCIpIHtcbiAgICAgIHJldHVybiBhY2MgKyAxMDtcbiAgICB9XG4gICAgZWxzZSBpZiAoY2FyZC52YWx1ZSA9PT0gXCJBQ0VcIikge1xuICAgICAgaWYgKGFjYyArIDExIDwgMjIpIHtyZXR1cm4gYWNjICsgMTF9XG4gICAgICBlbHNlIHtyZXR1cm4gYWNjICsgMX1cbiAgICB9XG4gICAgZWxzZSB7cmV0dXJuIGFjYyArIHBhcnNlSW50KGNhcmQudmFsdWUpfVxuICB9LCAwKVxuXG4gIGlmICh0b3RhbCA+IDIxICYmIGFjZXNfYW10ID4gMSkge1xuICAgIHZhciBiaWdfdG90YWwgPSBzdW1fYXJyYXkucmVkdWNlKGZ1bmN0aW9uKGFjYywgY2FyZCkge1xuICAgICAgaWYgKGNhcmQudmFsdWUgPT09IFwiS0lOR1wiIHx8IGNhcmQudmFsdWUgPT09IFwiUVVFRU5cIiB8fCBjYXJkLnZhbHVlID09PSBcIkpBQ0tcIikge1xuICAgICAgICByZXR1cm4gYWNjICsgMTA7XG4gICAgICB9XG4gICAgICBlbHNlIGlmIChjYXJkLnZhbHVlID09PSBcIkFDRVwiKSB7XG4gICAgICAgIHJldHVybiBhY2MgKyAxMVxuICAgICAgfVxuICAgICAgZWxzZSB7cmV0dXJuIGFjYyArIHBhcnNlSW50KGNhcmQudmFsdWUpfVxuICAgIH0sIDApXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPD0gYWNlc19hbXQ7IGkrKykge1xuICAgICAgaWYgKGJpZ190b3RhbCAtICgxMCAqIGkpIDwgMjIpIHtcbiAgICAgICAgdG90YWwgPSBiaWdfdG90YWwgLSAoMTAgKiBpKTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgd2hvbS50b0xvd2VyQ2FzZSgpID09PSBcInBsYXllclwiID8gKGdhbWUucGxheWVydG90YWwgPSB0b3RhbCkgOiAoZ2FtZS5kZWFsZXJ0b3RhbCA9IHRvdGFsKTtcbn1cblxuLy8gYWNlcyB0byBiYWNrIG9mIGFycmF5IGZvciBzdW1tYXRpb24gcHVycG9zZXMuXG4vLyBMb29rIGF0IGFsbCBjYXJkczsgYWNlPyBJZiBzbyBtb3ZlIGl0IHRvIHRoZSBiYWNrLiBOb3QgYWNlPyBNb3ZlIGl0IHRvIHRoZSBmcm9udC5cbmZ1bmN0aW9uIGFjZXNUb0JhY2soYXJyKSB7XG4gIHZhciByZXR1cm5fYXJyID0gW107XG4gIGFyci5mb3JFYWNoKGZ1bmN0aW9uKGNhcmQpIHtcbiAgICBpZiAoY2FyZC52YWx1ZSA9PT0gXCJBQ0VcIikge3JldHVybl9hcnIucHVzaChjYXJkKX1cbiAgICBlbHNlIHtyZXR1cm5fYXJyLnVuc2hpZnQoY2FyZCl9XG4gIH0pXG4gIHJldHVybiByZXR1cm5fYXJyO1xufVxuXG4vLyBEZWFsZXIncyBmaXJzdCB0dXJuLiBEZWFsIDIgY2FyZHMgdG8gdGhlIGRlYWxlciwgYW5kIGFmdGVyIHRoZSBkYXRhIGlzIGxvYWRlZCwgaW52b2tlIGRlYWxlckxvb3AgYXMgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuLy8gTm90ZSB0aGF0IHRoZSBwbGF5ZXIgYWN0dWFsbHkgZ29lcyBmaXJzdDsgY29kZSBpcyBpbiB0aGlzIG9yZGVyIGJlY2F1c2UgSSBnb3QgdGhhdCB3cm9uZyBhdCBmaXJzdC5cbmZ1bmN0aW9uIGRlYWxlckluaXRpYWxUdXJuKCkge1xuICBkZWFsQ2FyZHMoXCJkZWFsZXJcIiwgMiwgZGVhbGVyTG9vcCk7XG59XG5cbi8vIE1ha2UgZGVhbGVyJ3MgdHVybnMgZ28gc2xvd2VyIChpZSwgbm90IGluc3RhbnRhbmVvdXNseSkgc28gdGhhdCBpdCBmZWVscyBsaWtlIGEgY2FyZCBnYW1lIGlzIGFjdHVhbGx5IGJlaW5nIHBsYXllZCBvdXQ7XG4vLyBkbyBzbyBieSBzZXR0aW5nIGEgdGltZW91dCBvbiBlYWNoIHN1YnNlcXVlbnQgZnVuY3Rpb24gY2FsbCAoaWUsIGVhY2ggKm5leHQqIGRlYWxlciB0dXJuKSB0aGF0IGRlbGF5cyB0aGF0IG5leHQgdHVybiBieVxuLy8gREVBTEVSX1RVUk5fREVMQVkgbWlsbGlzZWNvbmRzOyBhZGp1c3QgdGhpcyBjb25zdGFudCBmcm9tIHRoZSB0b3Agb2YgdGhpcyBmaWxlLlxuZnVuY3Rpb24gZGVhbGVyTG9vcCgpIHtcbiAgaWYgKGdhbWUuZGVhbGVydG90YWwgPCAxNykge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7ZGVhbENhcmRzKFwiZGVhbGVyXCIsIDEsIGRlYWxlckxvb3ApfSwgREVBTEVSX1RVUk5fREVMQVkpO1xuICB9IGVsc2Uge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7ZGVhbGVyVHVyblJlc3VsdCgpfSwgREVBTEVSX1RVUk5fREVMQVkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1ha2UkUChzdHJpbmcpIHtcbiAgcmV0dXJuICgkKFwiPHA+XCIgKyBzdHJpbmcgKyBcIjwvcD5cIikuYWRkQ2xhc3MoXCJhbmltYXRlZCBmYWRlSW5cIikpO1xufVxuXG5mdW5jdGlvbiBkZWFsZXJUdXJuUmVzdWx0KCkge1xuICBpZiAoZ2FtZS5kZWFsZXJ0b3RhbCA9PT0gMjEgJiYgZ2FtZS5kZWFsZXJfY2FyZHMubGVuZ3RoID09PSAyICYmIGdhbWUucGxheWVyYmxhY2tqYWNrID09PSBmYWxzZSkge1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJCbGFja2phY2shXCIpLnJlbW92ZUNsYXNzKFwiZmFkZUluXCIpLmFkZENsYXNzKFwiZmxhc2hcIikpO1xuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIiBEZWFsZXIgd2lucyFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpKVxuICAgIH0sIE1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9XG4gIGVsc2UgaWYgKGdhbWUuZGVhbGVydG90YWwgPT09IDIxICYmIGdhbWUuZGVhbGVyX2NhcmRzLmxlbmd0aCA9PT0gMiAmJiBnYW1lLnBsYXllcmJsYWNramFjayA9PT0gdHJ1ZSkge1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJEb3VibGUtYmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKTtcbiAgICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJQdXNoIVwiKSk7XG4gICAgfSwgTVNHX1NUQUdHRVIpKTtcbiAgICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH1cbiAgZWxzZSBpZiAoZ2FtZS5wbGF5ZXJibGFja2phY2sgPT09IHRydWUpIHtcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiQmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKTtcbiAgICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCIgWW91IHdpbiFcIikuYWRkQ2xhc3MoXCJ3aW5cIikpO1xuICAgIH0sIE1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9XG4gIGVsc2UgaWYgKGdhbWUuZGVhbGVydG90YWwgPiAyMSkge1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJEZWFsZXIgYnVzdHMhXCIpKVxuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCIgWW91IHdpbiFcIikuYWRkQ2xhc3MoXCJ3aW5cIikpO1xuICAgIH0sIE1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9IGVsc2Uge1xuICAgIGZpbmFsUmVja29uaW5nKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGxheWVySW5pdGlhbFR1cm4oKSB7XG4gIGRlYWxDYXJkcyhcInBsYXllclwiLCAyLCBwbGF5ZXJMb29wKTtcbn1cblxuZnVuY3Rpb24gcGxheWVyTG9vcCgpIHtcbiAgZ2FtZS5wbGF5ZXJ0dXJuICs9IDE7XG4gIGZsaXBQbGF5ZXJDYXJkcygpO1xuICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA9PT0gMjEgJiYgZ2FtZS5wbGF5ZXJ0dXJuID09PSAxKSB7XG4gICAgZ2FtZS5wbGF5ZXJibGFja2phY2sgPSB0cnVlO1xuICAgIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpO1xuICB9IGVsc2UgaWYgKGdhbWUucGxheWVydG90YWwgPCAyMikge1xuICAgIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFyQ2xpY2tzKCkge1xuICBldmVudF9hcnJheS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KXtcbiAgICBjbGVhclRpbWVvdXQoZXZlbnQpO1xuICB9KVxufVxuXG5mdW5jdGlvbiBwbGF5ZXJCdXN0cygpIHtcbiAgY2xlYXJDbGlja3MoKTtcbiAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJZb3UgYnVzdGVkIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcInN3aW5nXCIpKTtcbiAgbWVzc2FnZV9ldmVudHMucHVzaChzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIiBZb3UgbG9zZSFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpKTtcbiAgfSwgTVNHX1NUQUdHRVIpKTtcbiAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gIGFwcGVuZE5ld0dhbWVCdXR0b24oKTtcbn1cblxuLy8gaWYgdGhlIG5laXRoZXIgdGhlIGRlYWxlciBub3IgdGhlIHBsYXllciB3b24gb3V0cmlnaHQgb3IgYnVzdGVkIGR1cmluZyB0aGVpciByZXNwZWN0aXZlIHR1cm5zLCB3ZSBuZWVkIHRvIGNvbXBhcmUgdGhlIHRvdGFsc1xuLy8gdG8gc2VlIHdobyB3b24uXG5mdW5jdGlvbiBmaW5hbFJlY2tvbmluZygpIHtcbiAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIllvdXIgdG90YWw6IFwiICsgZ2FtZS5wbGF5ZXJ0b3RhbCkuYWRkQ2xhc3MoXCJub21hcmdpblwiKSk7XG4gIFxuICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKXskTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiRGVhbGVyJ3MgdG90YWw6IFwiICsgZ2FtZS5kZWFsZXJ0b3RhbCkuYWRkQ2xhc3MoXCJub21hcmdpblwiKSl9LCBNU0dfU1RBR0dFUikpO1xuICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IGdhbWUuZGVhbGVydG90YWwpIHtcbiAgICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7JE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIllvdSB3aW4hXCIpLmFkZENsYXNzKFwid2luXCIpLmFkZENsYXNzKFwibm9tYXJnaW5cIikpO30sIDIqTVNHX1NUQUdHRVIpKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gIH0gZWxzZSBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA9PT0gZ2FtZS5kZWFsZXJ0b3RhbCkge1xuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpeyRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJQdXNoIVwiKS5hZGRDbGFzcyhcIm5vbWFyZ2luXCIpKTt9LCAyKk1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9IGVsc2Uge1xuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpeyRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJZb3UgbG9zZSFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpLmFkZENsYXNzKFwibm9tYXJnaW5cIikpO30sIDIqTVNHX1NUQUdHRVIpKTtcbiAgICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0UGxheWVyQ2FyZHMoY2FyZF9hcnIpIHtcbiAgY2FyZF9hcnIuZm9yRWFjaChmdW5jdGlvbihjYXJkX29iaikge1xuICAgIHZhciAkY2FyZCA9IGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopO1xuICAgICRQTEFZRVJIQU5ELmFwcGVuZCgkY2FyZCk7XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRnJvbnQkSU1HKGNhcmRfb2JqKSB7XG4gIGlmIChjYXJkX29iai52YWx1ZSA9PT0gXCJBQ0VcIiAmJiBjYXJkX29iai5zdWl0ID09PSBcIkRJQU1PTkRTXCIpe1xuICAgIGNhcmRfb2JqLmltYWdlID0gXCJpbWFnZXMvQWNlT2ZEaWFtb25kcy5wbmdcIjtcbiAgfVxuICB2YXIgJGNhcmQgPSAkKFwiPGltZyBzcmM9J1wiICsgY2FyZF9vYmouaW1hZ2UgKyBcIic+XCIpO1xuICByZXR1cm4gJGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopIHtcbiAgaWYgKGNhcmRfb2JqLnZhbHVlID09PSBcIkFDRVwiICYmIGNhcmRfb2JqLnN1aXQgPT09IFwiRElBTU9ORFNcIil7XG4gICAgY2FyZF9vYmouaW1hZ2UgPSBcImltYWdlcy9BY2VPZkRpYW1vbmRzLnBuZ1wiO1xuICB9XG4gIHZhciAkY2FyZCA9ICQoXCI8aW1nIHNyYz0nXCIgKyBDQVJEX0JBQ0tfVVJMICsgXCInIGZyb250X3VybCA9ICdcIiArIGNhcmRfb2JqLmltYWdlICsgXCInPlwiKTtcbiAgcmV0dXJuICRjYXJkO1xufVxuXG5mdW5jdGlvbiBpbnNlcnREZWFsZXJDYXJkcyhjYXJkX2Fycikge1xuICBjYXJkX2Fyci5mb3JFYWNoKGZ1bmN0aW9uKGNhcmRfb2JqLCBpKSB7XG4gICAgdmFyICRjYXJkID0gZ2VuZXJhdGVCYWNrJElNRyhjYXJkX29iaik7XG4gICAgJERFQUxFUkhBTkQuYXBwZW5kKCRjYXJkKTtcbiAgICBpZiAoJERFQUxFUkhBTkQuY2hpbGRyZW4oKS5sZW5ndGggPT09IDIpIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXskREVBTEVSSEFORC5jaGlsZHJlbigpWzBdLnNyYyA9ICRERUFMRVJIQU5ELmNoaWxkcmVuKClbMF0uZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpO30sIENBU0NBREVfRkxJUF9USU1FKVxuICAgIH1cbiAgfSlcbn1cblxuLy8gYXBwZW5kIGNvbnRyb2xzIGFuZCBhd2FpdCBwbGF5ZXIgZGVjaXNpb25cbmZ1bmN0aW9uIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpIHtcbiAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gIGlmIChnYW1lLnBsYXllcnRvdGFsICE9PSAyMSkge1xuICAgIHZhciAkaGl0ID0gJChcIjxidXR0b24gY2xhc3M9J2hpdC1idG4nPkhpdDwvYnV0dG9uPlwiKTtcbiAgICAkUExBWUVSQ09OVFJPTFMuYXBwZW5kKCRoaXQpO1xuICB9XG4gIHZhciAkc3RpY2sgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nc3RpY2stYnRuJz5TdGFuZDwvYnV0dG9uPlwiKTtcbiAgJFBMQVlFUkNPTlRST0xTLmFwcGVuZCgkc3RpY2spO1xufVxuXG5mdW5jdGlvbiBhcHBlbmROZXdHYW1lQnV0dG9uKCkge1xuICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgdmFyICRuZXdnYW1lID0gJChcIjxidXR0b24gY2xhc3M9J25ld2dhbWUnPk5ldyBHYW1lPC9idXR0b24+XCIpO1xuICAkUExBWUVSQ09OVFJPTFMuYXBwZW5kKCRuZXdnYW1lKTtcbiAgaWYgKGNsaWNrc09uID09PSBmYWxzZSkge1xuICAgIHNldENsaWNrSGFuZGxlcnMoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmbGlwRGVhbGVyQ2FyZHMoKSB7XG4gIHZhciBpbWdfYXJyID0gW10uc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmRlYWxlci1oYW5kIGltZ1wiKSk7XG4gIC8vIGRvbid0IHdhc3RlIHRpbWUgY2hlY2tpbmcgdGhlIGZpcnN0IGNhcmQ7IGl0J3MgYWxyZWFkeSBmbGlwcGVkIGZvciBzdXJlLlxuICB2YXIgaSA9IDE7XG4gIHZhciBsZW5ndGggPSBpbWdfYXJyLmxlbmd0aDtcbiAgZnVuY3Rpb24gZGVsYXllZEZsaXAoKSB7XG5cbiAgICAvLyBUaGlzIGNvZGUgd2lsbCBoYXZlIGFsbCBvZiBkZWFsZXIncyBjYXJkcyBmbGlwIGF0IG9uY2UgdXBvbiBhIGdhbWUgb3Zlci5cblxuICAgIC8vIGltZ19hcnIuZm9yRWFjaChmdW5jdGlvbihpbWcpIHtcbiAgICAvLyAgIGlmIChpbWcuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpKSB7XG4gICAgLy8gICAgIGltZy5zcmMgPSBpbWcuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpO1xuICAgIC8vICAgfVxuICAgIC8vIH0pXG5cbiAgICAvLyBjb2RlIGJlbG93IHdpbGwgbWFrZSB0aGUgZGVhbGVyJ3MgY2FyZHMgYWxsIGZsaXAgaW4gYSBjYXNjYWRlXG4gICAgLy8gaW5zdGVhZCBvZiBhbGwgYXQgb25jZSB3aGVuIHRoZSBnYW1lIGVuZHMuXG5cbiAgICBpZiAoaSA8IGxlbmd0aCkge1xuICAgICAgLy9kb24ndCBuZWVkIHRoZSBiZWxvdyBjaGVjayAoaWYgc3RhdGVtZW50KSwgYXMgd2UncmUgc3RhcnRpbmcgZnJvbSB0aGUgc2Vjb25kIGNhcmQsXG4gICAgICAvLyB3aGljaCBoYXMgZGVmaW50ZWx5IG5vdCBiZWVuIGZsaXBwZWQuXG4gICAgICAvL2lmIChpbWdfYXJyW2ldLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKSAhPT0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJzcmNcIikpIHtcbiAgICAgICAgaW1nX2FycltpXS5zcmMgPSBpbWdfYXJyW2ldLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKTtcbiAgICAgIC8vfVxuICAgICAgaSArPSAxO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe2RlbGF5ZWRGbGlwKCl9LCBERUFMRVJfQ0FTQ0FERV9GTElQX1RJTUUpO1xuICAgIH1cbiAgfVxuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ZGVsYXllZEZsaXAoKTt9LCBERUFMRVJfQ0FTQ0FERV9GTElQX1RJTUUpO1xufVxuXG4vLyBDaGFuZ2VkIHRoaXMgdXAgc3VjaCB0aGF0IHRoZSBnYW1lIHdvbid0IGRpc3BsYXkgYWxsIHRoZSBcImhleSB5b3UgYnVzdGVkXCIgZ3JhcGhpY3MgdW50aWwgdGhlIGxhc3QgY2FyZCBoYXMgYmVlbiBmbGlwcGVkLlxuLy8gQWxzbyBoYWQgdG8gdXNlIGNsb3N1cmUgdG8gZW5zdXJlIHRoYXQgdGhlIHRpbWVvdXRzIGFjdHVhbGx5IGZsaXAgdGhlIGNhcmQgYXQgaW5kZXggaSBhY2NvcmRpbmcgdG8gd2hhdCBpIHdhc1xuLy8gd2hlbiB0aGUgdGltZW91dCB3YXMgY3JlYXRlZCAodGhpcyBpcyBhY3R1YWxseSBleGFjdGx5IGxpa2Ugd2hhdCBDcm9ja2ZvcmQgdGFsa2VkIGFib3V0IGhlcmU6XG4vLyBodHRwOi8vcWRldmRpdmUuYmxvZ3Nwb3QuY29tLzIwMTUvMDQvY3JvY2tmb3Jkcy1jb25jb2N0aW9uLmh0bWxcbmZ1bmN0aW9uIGZsaXBQbGF5ZXJDYXJkcygpIHtcbiAgdmFyIGltZ19hcnIgPSBbXS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIucGxheWVyLWhhbmQgaW1nXCIpKTtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuZ3RoID0gaW1nX2Fyci5sZW5ndGg7XG4gIGZ1bmN0aW9uIGRlbGF5ZWRGbGlwKCkge1xuICAgIGlmIChpIDwgbGVuZ3RoKSB7XG4gICAgICBpZiAoaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIikgIT09IGltZ19hcnJbaV0uZ2V0QXR0cmlidXRlKFwic3JjXCIpKXtcbiAgICAgICAgZnVuY3Rpb24gbmVlZFRoaXNGb3JDbG9zdXJlKGkpe1xuICAgICAgICAgIHZhciBjYXJkRmxpcCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGltZ19hcnJbaV0uc3JjID0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIik7XG4gICAgICAgICAgICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IDIxICYmICRNU0dBUkVBLmlzKCc6ZW1wdHknKSkge1xuICAgICAgICAgICAgICBwbGF5ZXJCdXN0cygpO1xuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjbGlja3NPbiA9PT0gZmFsc2UgJiYgZ2FtZS5wbGF5ZXJ0b3RhbCA8IDIyKSB7XG4gICAgICAgICAgICAgIHNldENsaWNrSGFuZGxlcnMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGF5ZWRGbGlwKCk7XG4gICAgICAgICAgfSwgQ0FTQ0FERV9GTElQX1RJTUUpO1xuICAgICAgICAgIGNhcmRmbGlwX2V2ZW50cy5wdXNoKGNhcmRGbGlwKTtcbiAgICAgICAgfVxuICAgICAgICBuZWVkVGhpc0ZvckNsb3N1cmUoaSk7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaSArPSAxO1xuICAgICAgZGVsYXllZEZsaXAoKTtcbiAgICB9XG4gIH1cbiAgZGVsYXllZEZsaXAoKTtcbn1cblxuZnVuY3Rpb24gZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCkge1xuICBmbGlwRGVhbGVyQ2FyZHMoKTtcbiAgY2FyZGZsaXBfZXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBjbGVhclRpbWVvdXQoZXZlbnQpO1xuICB9KVxuICB2YXIgaW1nX2FyciA9IFtdLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5wbGF5ZXItaGFuZCBpbWdcIikpO1xuICBpbWdfYXJyLmZvckVhY2goZnVuY3Rpb24oY2FyZCkge1xuICAgIGlmIChjYXJkLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKSAmJiBjYXJkLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKSAhPT0gY2FyZC5nZXRBdHRyaWJ1dGUoXCJzcmNcIikpe1xuICAgICAgY2FyZC5zcmMgPSBjYXJkLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKTtcbiAgICB9XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGNsZWFyTWVzc2FnZXMoKSB7XG4gIG1lc3NhZ2VfZXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBjbGVhclRpbWVvdXQoZXZlbnQpO1xuICB9KVxufVxuIl19