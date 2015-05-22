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
  var cards = whom.toLowerCase() === "player" ? game.player_cards : game.dealer_cards;
  var sum = 0;
  var aces_amt = 0;
  var total;
  cards.forEach(function (card) {
    if (card.value === "KING" || card.value === "QUEEN" || card.value === "JACK") {
      sum += 10;
    } else if (card.value === "ACE") {
      aces_amt += 1;
    } else {
      sum += parseInt(card.value);
    }
  });

  // works because you would only ever have one ace going to 11.
  if (sum + aces_amt + 10 < 22 && aces_amt > 0) {
    total = sum + aces_amt + 10;
  } else {
    total = sum + aces_amt;
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
//# sourceMappingURL=data:application/json;base64,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QUssSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLENBQUMsRUFBQztBQUNoRyxVQUFJLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDM0M7R0FDRixDQUFDLENBQUE7Q0FDSDs7QUFFRCxTQUFTLGFBQWEsR0FBRztBQUN2QixnQkFBYyxDQUFDLE9BQU8sQ0FBQyxVQUFTLEtBQUssRUFBRTtBQUNyQyxnQkFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0dBQ3JCLENBQUMsQ0FBQTtDQUNIIiwiZmlsZSI6InNyYy9qcy9tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsidmFyIEFQSV9VUkwgPSBcImh0dHA6Ly9kZWNrb2ZjYXJkc2FwaS5jb20vYXBpXCI7XG52YXIgQVBJX1BST1hZID0gXCJodHRwczovL2pzb25wLmFmZWxkLm1lLz91cmw9XCI7XG52YXIgZ2FtZTtcbnZhciBDQVJEX0JBQ0tfVVJMID0gXCJpbWFnZXMvYmFjay5wbmdcIjtcbnZhciAkREVBTEVSSEFORCA9ICQoJy5kZWFsZXItaGFuZCcpO1xudmFyICRQTEFZRVJIQU5EID0gJCgnLnBsYXllci1oYW5kJyk7XG52YXIgJFBMQVlFUkNPTlRST0xTID0gJCgnLnBsYXllci1jb250cm9scycpO1xudmFyICRERUFMRVJNU0cgPSAkKCcuZGVhbGVyLW1zZycpO1xudmFyICRQTEFZRVJNU0cgPSAkKCcucGxheWVyLW1zZycpO1xudmFyICRQTEFZRVJXUkFQUEVSID0gJCgnLnBsYXllci13cmFwcGVyJyk7XG52YXIgJE1TR0FSRUEgPSAkKCcubXNnLWFyZWEnKVxudmFyIGNsaWNrc09uID0gZmFsc2U7XG52YXIgbWVzc2FnZV9ldmVudHMgPSBbXTtcbnZhciBjYXJkZmxpcF9ldmVudHMgPSBbXTtcbnZhciBldmVudF9hcnJheSA9IFtdO1xuXG4vLyB0aW1lIGJldHdlZW4gbWVzc2FnZXMgd3JpdHRlbiB0byB0aGUgXCJib2FyZFwiIHdoZW4gdGhlIGdhbWUgY29uY2x1ZGVzLlxudmFyIE1TR19TVEFHR0VSID0gNjAwO1xuXG4vLyB0aW1lIGJldHdlZW4gZGVhbGVyJ3MgY2FyZCBmbGlwcyB1cG9uIGEgZ2FtZSBvdmVyLlxudmFyIERFQUxFUl9DQVNDQURFX0ZMSVBfVElNRSA9IDEyMDtcblxuLy8gdGltZSBiZXR3ZWVuIGRlYWxlcidzIGluZGl2aWR1YWwgdHVybnNcbnZhciBERUFMRVJfVFVSTl9ERUxBWSA9IDE1MDA7XG5cbi8vIHRpbWUgYmV0d2VlbiBlYWNoIGluZGl2aWR1YWwgY2FyZCBmbGlwXG4vLyBmb3IgdGhlIHBsYXllcidzIGNhcmRzIGFmdGVyIGVhY2ggbmV3IGNhcmQgYWRkZWQgKDIgaW4gdGhlIGJlZ2lubmluZylcbi8vIGFuZCBmb3IgdGhlIGZsaXAgb2YgdGhlIGRlYWxlcidzIGZpcnN0IGNhcmQuXG4vLyAod2hpY2ggaXMgY3VycmVudGx5IGZsaXBwZWQgYWZ0ZXIgdGhlIGRlYWxlcidzICpzZWNvbmQqIGNhcmQgaXMgc2hvd24uXG52YXIgQ0FTQ0FERV9GTElQX1RJTUUgPSA0MDA7XG5cbnN0YXJ0R2FtZSgpO1xuXG4vLyB0byBzdGFydCBvZmYgdGhlIGdhbWUsIG1ha2UgYSBuZXcgZ2FtZSBvYmplY3QgKHdpdGggYXR0cmlidXRlcyB0aGF0IHdpbGwgcHJlc2VydmUgdGhlIGdhbWUncyBzdGF0ZSwgaWUsIHdobyBoYXMgd2hhdCBjYXJkcykgYW5kIHRoZW5cbi8vIGFzayB0aGUgQVBJIGZvciBhIGRlY2sgSUQgdG8gYXNzaWduIHRvIHRoZSBnYW1lIG9iamVjdCdzIGRlY2sgKHdlIG5lZWQgdG8gdXNlIGl0IGZvciBzdWJzZXF1ZW50IGNhbGxzIHRvIHRoZSBBUEksIHdoZW4gd2UgYXNrIGl0IGZvciBjYXJkcyBmcm9tXG4vLyBvdXIgZGVjaykuXG4vLyBXZSBjYW4ndCBkbyBhbnl0aGluZyB1bnRpbCB3ZSBoYXZlIHRoYXQgZGVjayBJRCwgYnV0IHRoZSBwcm9ncmFtIHdvdWxkIGhhcHBpbHkgY29udGludWUgb24gcHJpb3IgdG8gYWN0dWFsbHkgbG9hZGluZyB0aGUgb2JqZWN0IHRoYXQgY29udGFpbnMgdGhlXG4vLyBkZWNrIElELiBTbyB3ZSBuZWVkIGEgd2F5IHRvIG1ha2UgaXQgd2FpdCB1bnRpbCB0aGF0IG9iamVjdCBoYXMgc3VjY2Vzc2Z1bGx5IGxvYWRlZC0tIHdlIGRvIHNvIGJ5IG1ha2luZyB0aGUgbmV4dCBzdGVwIGluIHRoZSBwcm9ncmFtLCB3aGljaFxuLy8gaXMgdGhlIGRlYWxlcidzIGluaXRpYWwgdHVybiwgZmlyZSBhcyBwYXJ0IG9mIHRoZSBzZXREZWNrSUQgZnVuY3Rpb24ncyBjYWxsYmFjayBmdW5jdGlvbi4gVGhhdCB3YXkgaXQgd29uJ3QgaGFwcGVuIHVudGlsIGl0IGhhcyB0aGUgcmVxdWlzaXRlIGRhdGEuXG5mdW5jdGlvbiBzdGFydEdhbWUoKSB7XG4gIGdhbWUgPSBuZXcgR2FtZSgpO1xuICBjbGVhck1lc3NhZ2VzKCk7XG4gICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICAkREVBTEVSSEFORC5lbXB0eSgpO1xuICAkUExBWUVSSEFORC5lbXB0eSgpO1xuICAkTVNHQVJFQS5lbXB0eSgpO1xuICBzZXREZWNrSWQocGxheWVySW5pdGlhbFR1cm4pO1xuICAgIGlmIChjbGlja3NPbiA9PT0gZmFsc2UpIHtcbiAgICBzZXRDbGlja0hhbmRsZXJzKCk7XG4gIH1cbn1cblxuLy8gc2V0dGluZyB1cCBhIGdhbWUgb2JqZWN0IHRvIHByZXNlcnZlIHRoZSBnYW1lJ3Mgc3RhdGUuIFRoaXMgaXMgYSBjb25zdHJ1Y3RvciBmdW5jdGlvbiB0aGF0IGlzIGludm9rZWQgYWJvdmUgdmlhIFwiZ2FtZSA9IG5ldyBHYW1lKCk7XCIgdG9cbi8vIGdlbmVyYXRlIGEgZ2FtZSBvYmplY3Qgd2l0aCBhbGwgb2YgdGhlIGF0dHJpYnV0ZXMgbGlzdGVkIGJlbG93LlxuZnVuY3Rpb24gR2FtZSgpIHtcbiAgdGhpcy5kZWNrX2lkID0gXCJcIjtcbiAgdGhpcy5kZWFsZXJfY2FyZHMgPSBbXTtcbiAgdGhpcy5wbGF5ZXJfY2FyZHMgPSBbXTtcbiAgdGhpcy5wbGF5ZXJ0b3RhbCA9IDA7XG4gIHRoaXMuZGVhbGVydG90YWwgPSAwO1xuICB0aGlzLnBsYXllcnR1cm4gPSAwO1xuICB0aGlzLnBsYXllcmJsYWNramFjayA9IGZhbHNlO1xufVxuXG5mdW5jdGlvbiBzZXRDbGlja0hhbmRsZXJzKCkge1xuICAkUExBWUVSV1JBUFBFUi5vbignY2xpY2snLCAnLmhpdC1idG4nLCBmdW5jdGlvbihldmVudCkge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnRfYXJyYXkucHVzaChldmVudCk7XG4gICAgJFBMQVlFUldSQVBQRVIub2ZmKCdjbGljaycpO1xuICAgIGNsaWNrc09uID0gZmFsc2U7XG4gICAgaWYgKGdhbWUucGxheWVydG90YWwgPCAyMSkge1xuICAgICAgZGVhbENhcmRzKFwicGxheWVyXCIsIDEsIHBsYXllckxvb3ApO1xuICAgIH1cbiAgfSkub24oJ2NsaWNrJywgJy5zdGljay1idG4nLCBmdW5jdGlvbihldmVudCkge1xuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnRfYXJyYXkucHVzaChldmVudCk7XG4gICAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gICAgZGVhbGVySW5pdGlhbFR1cm4oKTtcbiAgfSkub24oJ2NsaWNrJywgJy5uZXdnYW1lJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAgIGV2ZW50X2FycmF5LnB1c2goZXZlbnQpO1xuICAgICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICAgIHN0YXJ0R2FtZSgpO1xuICB9KVxuICBjbGlja3NPbiA9IHRydWU7XG59XG5cbi8vIHNldCB0aGUgdGhlIGdhbWUgb2JqZWN0J3MgZGVja19pZCBieSBjYWxsaW5nIHRoZSBBUEkgYW5kIGxvb2tpbmcgYXQgdGhlIGRlY2tfaWQgYXR0cmlidXRlIG9mIHRoZSByZXNwb25zZSBpdCBnaXZlcyB1cy5cbi8vIEFmdGVyIHRoZSBkYXRhIGhhcyBsb2FkZWQgKGFuZCB3cml0dGVuIHRvIHRoZSBnYW1lIG9iamVjdCksIG91ciBjYWxsYmFjayBmdW5jdGlvbiBmaXJlcyBvZmYsIHdoaWNoIHdlJ3ZlIHNldCB1cCB0byBiZSB3aGF0ZXZlciBmdW5jdGlvbiB3ZSBwYXNzIGluLlxuLy8gV2UgcGFzcyBpbiBwbGF5ZXJJbml0aWFsVHVybiAobGluZSA0NCkgc28gdGhhdCB0aGUgZ2FtZSBzdGFydHMuXG5cbmZ1bmN0aW9uIHNldERlY2tJZChjYWxsYmFjaykge1xuICAkLmdldChBUElfUFJPWFkgKyBBUElfVVJMICsgXCIvc2h1ZmZsZS8/ZGVja19jb3VudD02XCIsIGZ1bmN0aW9uKG9iail7XG4gICAgZ2FtZS5kZWNrX2lkID0gb2JqLmRlY2tfaWQ7XG4gICAgY2FsbGJhY2soKTtcbiAgfSwgJ2pzb24nKTtcbn1cblxuLy8gc3BlY2lmeSBcInBsYXllclwiIG9yIFwiZGVhbGVyXCIgYW5kIGhvdyBtYW55IGNhcmRzLiBUaGVpciBhcnJheSB3aWxsIGJlIHBvcHVsYXRlZCB3aXRoIHRoZSBjYXJkcyAodmlhIGFycmF5IGNvbmNhdGVuYXRpb24pXG4vLyBhbmQgdGhlIHRvdGFsIHVwZGF0ZWQgKHdpbGwgbWFrZSBBY2VzIHdvcnRoXG4vLyAxIGluc3RlYWQgb2YgMTEgaWYgaXQgd2lsbCBwcmV2ZW50IGJ1c3Rpbmc7IHNlZSBzdWJzZXF1ZW50IGZ1bmN0aW9ucyBmb3IgZGV0YWlscyBvbiBob3cgdGhpcyBoYXBwZW5zLlxuLy8gaHR0cDovL2RlY2tvZmNhcmRzYXBpLmNvbS8gc2hvd3Mgd2hhdCB0aGUgcmVzcG9uc2Ugb2JqZWN0IGxvb2tzIGxpa2U7IGNoZWNrIHVuZGVyIFwiZHJhdyBhIGNhcmRcIi5cbmZ1bmN0aW9uIGRlYWxDYXJkcyh0b3dob20sIG51bSwgY2FsbGJhY2spIHtcbiAgdmFyIGdldF91cmwgPSBBUElfUFJPWFkgKyBBUElfVVJMICsgXCIvZHJhdy9cIiArIGdhbWUuZGVja19pZCArIFwiLz9jb3VudD1cIiArIG51bTtcbiAgJC5nZXQoZ2V0X3VybCwgZnVuY3Rpb24ob2JqKXtcbiAgICBpZiAodG93aG9tLnRvTG93ZXJDYXNlKCkgPT09IFwicGxheWVyXCIpIHtcbiAgICAgIGlmIChnYW1lLnBsYXllcnRvdGFsIDwgMjIpIHtcbiAgICAgICAgZ2FtZS5wbGF5ZXJfY2FyZHMgPSBnYW1lLnBsYXllcl9jYXJkcy5jb25jYXQob2JqLmNhcmRzKTtcbiAgICAgICAgaW5zZXJ0UGxheWVyQ2FyZHMob2JqLmNhcmRzKTtcbiAgICAgICAgdXBkYXRlVG90YWwoXCJwbGF5ZXJcIik7XG4gICAgICB9XG4gICAgICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IDIxICYmICEoJChcIi5uZXdnYW1lXCIpLmxlbmd0aCkpIHtcbiAgICAgICAgJFBMQVlFUldSQVBQRVIub2ZmKCdjbGljaycpO1xuICAgICAgICBjbGlja3NPbiA9IGZhbHNlO1xuICAgICAgfVxuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIGdhbWUuZGVhbGVyX2NhcmRzID0gZ2FtZS5kZWFsZXJfY2FyZHMuY29uY2F0KG9iai5jYXJkcyk7XG4gICAgICBpbnNlcnREZWFsZXJDYXJkcyhvYmouY2FyZHMpO1xuICAgICAgdXBkYXRlVG90YWwoXCJkZWFsZXJcIik7XG4gICAgfVxuICAgIGNhbGxiYWNrKCk7XG4gIH0sICdqc29uJyk7XG59XG5cbi8vIGVudGVyIFwicGxheWVyXCIgb3IgXCJkZWFsZXJcIi4gSXQgd2lsbCBzdW0gdXAgdGhlIHRvdGFsIG9mIHRoZSBjYXJkcyxcbi8vIHdpdGggYWNlcyBtb3ZlZCB0byB0aGUgYmFjayBzbyB0aGF0IHRoZSBjb21wdXRlciBjYW4gZGVjaWRlIHRvIGNvdW50IHRoZW0gYXNcbi8vIDEgaWYgaXQgd2lsbCBwcmV2ZW50IGJ1c3RpbmcuIFRoZSBuZXcgdG90YWwgaXMgd3JpdHRlbiB0byB0aGUgZ2FtZSBvYmplY3QuIFRoaXMgZG9lc24ndCBtb2RpZnkgdGhlIG9yaWdpbmFsXG4vLyBjYXJkIG9yZGVyOyBkb24ndCB3YW50IHRvIGRvIHRoYXQsIGJlY2F1c2Ugd2Ugd2FudCB0byBrZWVwIHRoZSBvcmRlciBmb3IgZGlzcGxheSBwdXJwb3Nlcy5cbi8vIHNvIGRvaW5nIC5zbGljZSgpIG9uIHRoZSBjYXJkIGFycmF5cyB3aWxsIGxldCB1cyBtYWtlIHRoZSBhY2VzVG9CYWNrLWVkIGFycmF5cyBmcm9tIGNvcGllcy5cbmZ1bmN0aW9uIHVwZGF0ZVRvdGFsKHdob20pIHtcbiAgdmFyIGNhcmRzID0gd2hvbS50b0xvd2VyQ2FzZSgpID09PSBcInBsYXllclwiID8gZ2FtZS5wbGF5ZXJfY2FyZHMgOiBnYW1lLmRlYWxlcl9jYXJkcztcbiAgdmFyIHN1bSA9IDA7XG4gIHZhciBhY2VzX2FtdCA9IDA7XG4gIHZhciB0b3RhbDtcbiAgY2FyZHMuZm9yRWFjaChmdW5jdGlvbihjYXJkKSB7XG4gIFx0aWYgKGNhcmQudmFsdWUgPT09IFwiS0lOR1wiIHx8IGNhcmQudmFsdWUgPT09IFwiUVVFRU5cIiB8fCBjYXJkLnZhbHVlID09PSBcIkpBQ0tcIikge1xuICAgICAgc3VtICs9IDEwO1xuICBcdH0gZWxzZSBpZiAoY2FyZC52YWx1ZSA9PT0gXCJBQ0VcIikge1xuICAgICAgYWNlc19hbXQgKz0gMTtcbiAgICB9IGVsc2Uge1xuICAgIFx0c3VtICs9IHBhcnNlSW50KGNhcmQudmFsdWUpO1xuICAgIH1cbiAgfSlcblxuICAvLyB3b3JrcyBiZWNhdXNlIHlvdSB3b3VsZCBvbmx5IGV2ZXIgaGF2ZSBvbmUgYWNlIGdvaW5nIHRvIDExLlxuICBpZiAoc3VtICsgYWNlc19hbXQgKyAxMCA8IDIyICYmIGFjZXNfYW10ID4gMCkge1xuICAgIHRvdGFsID0gc3VtICsgYWNlc19hbXQgKyAxMDtcbiAgfSBlbHNlIHtcbiAgXHR0b3RhbCA9IHN1bSArIGFjZXNfYW10O1xuICB9XG5cbiAgd2hvbS50b0xvd2VyQ2FzZSgpID09PSBcInBsYXllclwiID8gKGdhbWUucGxheWVydG90YWwgPSB0b3RhbCkgOiAoZ2FtZS5kZWFsZXJ0b3RhbCA9IHRvdGFsKTtcbn1cblxuLy8gYWNlcyB0byBiYWNrIG9mIGFycmF5IGZvciBzdW1tYXRpb24gcHVycG9zZXMuXG4vLyBMb29rIGF0IGFsbCBjYXJkczsgYWNlPyBJZiBzbyBtb3ZlIGl0IHRvIHRoZSBiYWNrLiBOb3QgYWNlPyBNb3ZlIGl0IHRvIHRoZSBmcm9udC5cbmZ1bmN0aW9uIGFjZXNUb0JhY2soYXJyKSB7XG4gIHZhciByZXR1cm5fYXJyID0gW107XG4gIGFyci5mb3JFYWNoKGZ1bmN0aW9uKGNhcmQpIHtcbiAgICBpZiAoY2FyZC52YWx1ZSA9PT0gXCJBQ0VcIikge3JldHVybl9hcnIucHVzaChjYXJkKX1cbiAgICBlbHNlIHtyZXR1cm5fYXJyLnVuc2hpZnQoY2FyZCl9XG4gIH0pXG4gIHJldHVybiByZXR1cm5fYXJyO1xufVxuXG4vLyBEZWFsZXIncyBmaXJzdCB0dXJuLiBEZWFsIDIgY2FyZHMgdG8gdGhlIGRlYWxlciwgYW5kIGFmdGVyIHRoZSBkYXRhIGlzIGxvYWRlZCwgaW52b2tlIGRlYWxlckxvb3AgYXMgdGhlIGNhbGxiYWNrIGZ1bmN0aW9uLlxuLy8gTm90ZSB0aGF0IHRoZSBwbGF5ZXIgYWN0dWFsbHkgZ29lcyBmaXJzdDsgY29kZSBpcyBpbiB0aGlzIG9yZGVyIGJlY2F1c2UgSSBnb3QgdGhhdCB3cm9uZyBhdCBmaXJzdC5cbmZ1bmN0aW9uIGRlYWxlckluaXRpYWxUdXJuKCkge1xuICBkZWFsQ2FyZHMoXCJkZWFsZXJcIiwgMiwgZGVhbGVyTG9vcCk7XG59XG5cbi8vIE1ha2UgZGVhbGVyJ3MgdHVybnMgZ28gc2xvd2VyIChpZSwgbm90IGluc3RhbnRhbmVvdXNseSkgc28gdGhhdCBpdCBmZWVscyBsaWtlIGEgY2FyZCBnYW1lIGlzIGFjdHVhbGx5IGJlaW5nIHBsYXllZCBvdXQ7XG4vLyBkbyBzbyBieSBzZXR0aW5nIGEgdGltZW91dCBvbiBlYWNoIHN1YnNlcXVlbnQgZnVuY3Rpb24gY2FsbCAoaWUsIGVhY2ggKm5leHQqIGRlYWxlciB0dXJuKSB0aGF0IGRlbGF5cyB0aGF0IG5leHQgdHVybiBieVxuLy8gREVBTEVSX1RVUk5fREVMQVkgbWlsbGlzZWNvbmRzOyBhZGp1c3QgdGhpcyBjb25zdGFudCBmcm9tIHRoZSB0b3Agb2YgdGhpcyBmaWxlLlxuZnVuY3Rpb24gZGVhbGVyTG9vcCgpIHtcbiAgaWYgKGdhbWUuZGVhbGVydG90YWwgPCAxNykge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7ZGVhbENhcmRzKFwiZGVhbGVyXCIsIDEsIGRlYWxlckxvb3ApfSwgREVBTEVSX1RVUk5fREVMQVkpO1xuICB9IGVsc2Uge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7ZGVhbGVyVHVyblJlc3VsdCgpfSwgREVBTEVSX1RVUk5fREVMQVkpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG1ha2UkUChzdHJpbmcpIHtcbiAgcmV0dXJuICgkKFwiPHA+XCIgKyBzdHJpbmcgKyBcIjwvcD5cIikuYWRkQ2xhc3MoXCJhbmltYXRlZCBmYWRlSW5cIikpO1xufVxuXG5mdW5jdGlvbiBkZWFsZXJUdXJuUmVzdWx0KCkge1xuICBpZiAoZ2FtZS5kZWFsZXJ0b3RhbCA9PT0gMjEgJiYgZ2FtZS5kZWFsZXJfY2FyZHMubGVuZ3RoID09PSAyICYmIGdhbWUucGxheWVyYmxhY2tqYWNrID09PSBmYWxzZSkge1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJCbGFja2phY2shXCIpLnJlbW92ZUNsYXNzKFwiZmFkZUluXCIpLmFkZENsYXNzKFwiZmxhc2hcIikpO1xuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIiBEZWFsZXIgd2lucyFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpKVxuICAgIH0sIE1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9XG4gIGVsc2UgaWYgKGdhbWUuZGVhbGVydG90YWwgPT09IDIxICYmIGdhbWUuZGVhbGVyX2NhcmRzLmxlbmd0aCA9PT0gMiAmJiBnYW1lLnBsYXllcmJsYWNramFjayA9PT0gdHJ1ZSkge1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJEb3VibGUtYmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKTtcbiAgICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJQdXNoIVwiKSk7XG4gICAgfSwgTVNHX1NUQUdHRVIpKTtcbiAgICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH1cbiAgZWxzZSBpZiAoZ2FtZS5wbGF5ZXJibGFja2phY2sgPT09IHRydWUpIHtcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiQmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKTtcbiAgICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCIgWW91IHdpbiFcIikuYWRkQ2xhc3MoXCJ3aW5cIikpO1xuICAgIH0sIE1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9XG4gIGVsc2UgaWYgKGdhbWUuZGVhbGVydG90YWwgPiAyMSkge1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJEZWFsZXIgYnVzdHMhXCIpKVxuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpIHtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCIgWW91IHdpbiFcIikuYWRkQ2xhc3MoXCJ3aW5cIikpO1xuICAgIH0sIE1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9IGVsc2Uge1xuICAgIGZpbmFsUmVja29uaW5nKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGxheWVySW5pdGlhbFR1cm4oKSB7XG4gIGRlYWxDYXJkcyhcInBsYXllclwiLCAyLCBwbGF5ZXJMb29wKTtcbn1cblxuZnVuY3Rpb24gcGxheWVyTG9vcCgpIHtcbiAgZ2FtZS5wbGF5ZXJ0dXJuICs9IDE7XG4gIGZsaXBQbGF5ZXJDYXJkcygpO1xuICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA9PT0gMjEgJiYgZ2FtZS5wbGF5ZXJ0dXJuID09PSAxKSB7XG4gICAgZ2FtZS5wbGF5ZXJibGFja2phY2sgPSB0cnVlO1xuICAgIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpO1xuICB9IGVsc2UgaWYgKGdhbWUucGxheWVydG90YWwgPCAyMikge1xuICAgIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFyQ2xpY2tzKCkge1xuICBldmVudF9hcnJheS5mb3JFYWNoKGZ1bmN0aW9uKGV2ZW50KXtcbiAgICBjbGVhclRpbWVvdXQoZXZlbnQpO1xuICB9KVxufVxuXG5mdW5jdGlvbiBwbGF5ZXJCdXN0cygpIHtcbiAgY2xlYXJDbGlja3MoKTtcbiAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJZb3UgYnVzdGVkIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcInN3aW5nXCIpKTtcbiAgbWVzc2FnZV9ldmVudHMucHVzaChzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7XG4gICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIiBZb3UgbG9zZSFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpKTtcbiAgfSwgTVNHX1NUQUdHRVIpKTtcbiAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gIGFwcGVuZE5ld0dhbWVCdXR0b24oKTtcbn1cblxuLy8gaWYgdGhlIG5laXRoZXIgdGhlIGRlYWxlciBub3IgdGhlIHBsYXllciB3b24gb3V0cmlnaHQgb3IgYnVzdGVkIGR1cmluZyB0aGVpciByZXNwZWN0aXZlIHR1cm5zLCB3ZSBuZWVkIHRvIGNvbXBhcmUgdGhlIHRvdGFsc1xuLy8gdG8gc2VlIHdobyB3b24uXG5mdW5jdGlvbiBmaW5hbFJlY2tvbmluZygpIHtcbiAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIllvdXIgdG90YWw6IFwiICsgZ2FtZS5wbGF5ZXJ0b3RhbCkuYWRkQ2xhc3MoXCJub21hcmdpblwiKSk7XG4gIFxuICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKXskTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiRGVhbGVyJ3MgdG90YWw6IFwiICsgZ2FtZS5kZWFsZXJ0b3RhbCkuYWRkQ2xhc3MoXCJub21hcmdpblwiKSl9LCBNU0dfU1RBR0dFUikpO1xuICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IGdhbWUuZGVhbGVydG90YWwpIHtcbiAgICBtZXNzYWdlX2V2ZW50cy5wdXNoKHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7JE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIllvdSB3aW4hXCIpLmFkZENsYXNzKFwid2luXCIpLmFkZENsYXNzKFwibm9tYXJnaW5cIikpO30sIDIqTVNHX1NUQUdHRVIpKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gIH0gZWxzZSBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA9PT0gZ2FtZS5kZWFsZXJ0b3RhbCkge1xuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpeyRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJQdXNoIVwiKS5hZGRDbGFzcyhcIm5vbWFyZ2luXCIpKTt9LCAyKk1TR19TVEFHR0VSKSk7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9IGVsc2Uge1xuICAgIG1lc3NhZ2VfZXZlbnRzLnB1c2goc2V0VGltZW91dChmdW5jdGlvbigpeyRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJZb3UgbG9zZSFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpLmFkZENsYXNzKFwibm9tYXJnaW5cIikpO30sIDIqTVNHX1NUQUdHRVIpKTtcbiAgICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0UGxheWVyQ2FyZHMoY2FyZF9hcnIpIHtcbiAgY2FyZF9hcnIuZm9yRWFjaChmdW5jdGlvbihjYXJkX29iaikge1xuICAgIHZhciAkY2FyZCA9IGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopO1xuICAgICRQTEFZRVJIQU5ELmFwcGVuZCgkY2FyZCk7XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRnJvbnQkSU1HKGNhcmRfb2JqKSB7XG4gIGlmIChjYXJkX29iai52YWx1ZSA9PT0gXCJBQ0VcIiAmJiBjYXJkX29iai5zdWl0ID09PSBcIkRJQU1PTkRTXCIpe1xuICAgIGNhcmRfb2JqLmltYWdlID0gXCJpbWFnZXMvQWNlT2ZEaWFtb25kcy5wbmdcIjtcbiAgfVxuICB2YXIgJGNhcmQgPSAkKFwiPGltZyBzcmM9J1wiICsgY2FyZF9vYmouaW1hZ2UgKyBcIic+XCIpO1xuICByZXR1cm4gJGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopIHtcbiAgaWYgKGNhcmRfb2JqLnZhbHVlID09PSBcIkFDRVwiICYmIGNhcmRfb2JqLnN1aXQgPT09IFwiRElBTU9ORFNcIil7XG4gICAgY2FyZF9vYmouaW1hZ2UgPSBcImltYWdlcy9BY2VPZkRpYW1vbmRzLnBuZ1wiO1xuICB9XG4gIHZhciAkY2FyZCA9ICQoXCI8aW1nIHNyYz0nXCIgKyBDQVJEX0JBQ0tfVVJMICsgXCInIGZyb250X3VybCA9ICdcIiArIGNhcmRfb2JqLmltYWdlICsgXCInPlwiKTtcbiAgcmV0dXJuICRjYXJkO1xufVxuXG5mdW5jdGlvbiBpbnNlcnREZWFsZXJDYXJkcyhjYXJkX2Fycikge1xuICBjYXJkX2Fyci5mb3JFYWNoKGZ1bmN0aW9uKGNhcmRfb2JqLCBpKSB7XG4gICAgdmFyICRjYXJkID0gZ2VuZXJhdGVCYWNrJElNRyhjYXJkX29iaik7XG4gICAgJERFQUxFUkhBTkQuYXBwZW5kKCRjYXJkKTtcbiAgICBpZiAoJERFQUxFUkhBTkQuY2hpbGRyZW4oKS5sZW5ndGggPT09IDIpIHtcbiAgICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXskREVBTEVSSEFORC5jaGlsZHJlbigpWzBdLnNyYyA9ICRERUFMRVJIQU5ELmNoaWxkcmVuKClbMF0uZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpO30sIENBU0NBREVfRkxJUF9USU1FKVxuICAgIH1cbiAgfSlcbn1cblxuLy8gYXBwZW5kIGNvbnRyb2xzIGFuZCBhd2FpdCBwbGF5ZXIgZGVjaXNpb25cbmZ1bmN0aW9uIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpIHtcbiAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gIGlmIChnYW1lLnBsYXllcnRvdGFsICE9PSAyMSkge1xuICAgIHZhciAkaGl0ID0gJChcIjxidXR0b24gY2xhc3M9J2hpdC1idG4nPkhpdDwvYnV0dG9uPlwiKTtcbiAgICAkUExBWUVSQ09OVFJPTFMuYXBwZW5kKCRoaXQpO1xuICB9XG4gIHZhciAkc3RpY2sgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nc3RpY2stYnRuJz5TdGFuZDwvYnV0dG9uPlwiKTtcbiAgJFBMQVlFUkNPTlRST0xTLmFwcGVuZCgkc3RpY2spO1xufVxuXG5mdW5jdGlvbiBhcHBlbmROZXdHYW1lQnV0dG9uKCkge1xuICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgdmFyICRuZXdnYW1lID0gJChcIjxidXR0b24gY2xhc3M9J25ld2dhbWUnPk5ldyBHYW1lPC9idXR0b24+XCIpO1xuICAkUExBWUVSQ09OVFJPTFMuYXBwZW5kKCRuZXdnYW1lKTtcbiAgaWYgKGNsaWNrc09uID09PSBmYWxzZSkge1xuICAgIHNldENsaWNrSGFuZGxlcnMoKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBmbGlwRGVhbGVyQ2FyZHMoKSB7XG4gIHZhciBpbWdfYXJyID0gW10uc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmRlYWxlci1oYW5kIGltZ1wiKSk7XG4gIC8vIGRvbid0IHdhc3RlIHRpbWUgY2hlY2tpbmcgdGhlIGZpcnN0IGNhcmQ7IGl0J3MgYWxyZWFkeSBmbGlwcGVkIGZvciBzdXJlLlxuICB2YXIgaSA9IDE7XG4gIHZhciBsZW5ndGggPSBpbWdfYXJyLmxlbmd0aDtcbiAgZnVuY3Rpb24gZGVsYXllZEZsaXAoKSB7XG5cbiAgICAvLyBUaGlzIGNvZGUgd2lsbCBoYXZlIGFsbCBvZiBkZWFsZXIncyBjYXJkcyBmbGlwIGF0IG9uY2UgdXBvbiBhIGdhbWUgb3Zlci5cblxuICAgIC8vIGltZ19hcnIuZm9yRWFjaChmdW5jdGlvbihpbWcpIHtcbiAgICAvLyAgIGlmIChpbWcuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpKSB7XG4gICAgLy8gICAgIGltZy5zcmMgPSBpbWcuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpO1xuICAgIC8vICAgfVxuICAgIC8vIH0pXG5cbiAgICAvLyBjb2RlIGJlbG93IHdpbGwgbWFrZSB0aGUgZGVhbGVyJ3MgY2FyZHMgYWxsIGZsaXAgaW4gYSBjYXNjYWRlXG4gICAgLy8gaW5zdGVhZCBvZiBhbGwgYXQgb25jZSB3aGVuIHRoZSBnYW1lIGVuZHMuXG5cbiAgICBpZiAoaSA8IGxlbmd0aCkge1xuICAgICAgLy9kb24ndCBuZWVkIHRoZSBiZWxvdyBjaGVjayAoaWYgc3RhdGVtZW50KSwgYXMgd2UncmUgc3RhcnRpbmcgZnJvbSB0aGUgc2Vjb25kIGNhcmQsXG4gICAgICAvLyB3aGljaCBoYXMgZGVmaW50ZWx5IG5vdCBiZWVuIGZsaXBwZWQuXG4gICAgICAvL2lmIChpbWdfYXJyW2ldLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKSAhPT0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJzcmNcIikpIHtcbiAgICAgICAgaW1nX2FycltpXS5zcmMgPSBpbWdfYXJyW2ldLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKTtcbiAgICAgIC8vfVxuICAgICAgaSArPSAxO1xuICAgICAgc2V0VGltZW91dChmdW5jdGlvbigpe2RlbGF5ZWRGbGlwKCl9LCBERUFMRVJfQ0FTQ0FERV9GTElQX1RJTUUpO1xuICAgIH1cbiAgfVxuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ZGVsYXllZEZsaXAoKTt9LCBERUFMRVJfQ0FTQ0FERV9GTElQX1RJTUUpO1xufVxuXG4vLyBDaGFuZ2VkIHRoaXMgdXAgc3VjaCB0aGF0IHRoZSBnYW1lIHdvbid0IGRpc3BsYXkgYWxsIHRoZSBcImhleSB5b3UgYnVzdGVkXCIgZ3JhcGhpY3MgdW50aWwgdGhlIGxhc3QgY2FyZCBoYXMgYmVlbiBmbGlwcGVkLlxuLy8gQWxzbyBoYWQgdG8gdXNlIGNsb3N1cmUgdG8gZW5zdXJlIHRoYXQgdGhlIHRpbWVvdXRzIGFjdHVhbGx5IGZsaXAgdGhlIGNhcmQgYXQgaW5kZXggaSBhY2NvcmRpbmcgdG8gd2hhdCBpIHdhc1xuLy8gd2hlbiB0aGUgdGltZW91dCB3YXMgY3JlYXRlZCAodGhpcyBpcyBhY3R1YWxseSBleGFjdGx5IGxpa2Ugd2hhdCBDcm9ja2ZvcmQgdGFsa2VkIGFib3V0IGhlcmU6XG4vLyBodHRwOi8vcWRldmRpdmUuYmxvZ3Nwb3QuY29tLzIwMTUvMDQvY3JvY2tmb3Jkcy1jb25jb2N0aW9uLmh0bWxcbmZ1bmN0aW9uIGZsaXBQbGF5ZXJDYXJkcygpIHtcbiAgdmFyIGltZ19hcnIgPSBbXS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIucGxheWVyLWhhbmQgaW1nXCIpKTtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuZ3RoID0gaW1nX2Fyci5sZW5ndGg7XG4gIGZ1bmN0aW9uIGRlbGF5ZWRGbGlwKCkge1xuICAgIGlmIChpIDwgbGVuZ3RoKSB7XG4gICAgICBpZiAoaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIikgIT09IGltZ19hcnJbaV0uZ2V0QXR0cmlidXRlKFwic3JjXCIpKXtcbiAgICAgICAgZnVuY3Rpb24gbmVlZFRoaXNGb3JDbG9zdXJlKGkpe1xuICAgICAgICAgIHZhciBjYXJkRmxpcCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGltZ19hcnJbaV0uc3JjID0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIik7XG4gICAgICAgICAgICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IDIxICYmICRNU0dBUkVBLmlzKCc6ZW1wdHknKSkge1xuICAgICAgICAgICAgICBwbGF5ZXJCdXN0cygpO1xuICAgICAgICAgICAgICByZXR1cm5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGlmIChjbGlja3NPbiA9PT0gZmFsc2UgJiYgZ2FtZS5wbGF5ZXJ0b3RhbCA8IDIyKSB7XG4gICAgICAgICAgICAgIHNldENsaWNrSGFuZGxlcnMoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGRlbGF5ZWRGbGlwKCk7XG4gICAgICAgICAgfSwgQ0FTQ0FERV9GTElQX1RJTUUpO1xuICAgICAgICAgIGNhcmRmbGlwX2V2ZW50cy5wdXNoKGNhcmRGbGlwKTtcbiAgICAgICAgfVxuICAgICAgICBuZWVkVGhpc0ZvckNsb3N1cmUoaSk7XG4gICAgICAgIGkgKz0gMTtcbiAgICAgICAgcmV0dXJuO1xuICAgICAgfVxuICAgICAgaSArPSAxO1xuICAgICAgZGVsYXllZEZsaXAoKTtcbiAgICB9XG4gIH1cbiAgZGVsYXllZEZsaXAoKTtcbn1cblxuZnVuY3Rpb24gZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCkge1xuICBmbGlwRGVhbGVyQ2FyZHMoKTtcbiAgY2FyZGZsaXBfZXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBjbGVhclRpbWVvdXQoZXZlbnQpO1xuICB9KVxuICB2YXIgaW1nX2FyciA9IFtdLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5wbGF5ZXItaGFuZCBpbWdcIikpO1xuICBpbWdfYXJyLmZvckVhY2goZnVuY3Rpb24oY2FyZCkge1xuICAgIGlmIChjYXJkLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKSAmJiBjYXJkLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKSAhPT0gY2FyZC5nZXRBdHRyaWJ1dGUoXCJzcmNcIikpe1xuICAgICAgY2FyZC5zcmMgPSBjYXJkLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKTtcbiAgICB9XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGNsZWFyTWVzc2FnZXMoKSB7XG4gIG1lc3NhZ2VfZXZlbnRzLmZvckVhY2goZnVuY3Rpb24oZXZlbnQpIHtcbiAgICBjbGVhclRpbWVvdXQoZXZlbnQpO1xuICB9KVxufVxuIl19