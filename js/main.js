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
var cardflip_events = [];
var MSG_STAGGER = 600;

// time between dealer's card flips upon a game over.
var DEALER_CASCADE_FLIP_TIME = 180;

// time between dealer's individual turns
var DEALER_TURN_DELAY = 1500;

// time between each individual card flip once flipping has begun
var CASCADE_FLIP_TIME = 400;

$PLAYERWRAPPER.on("click", ".hit-btn", function (event) {
  event.preventDefault();
  dealCards("player", 1, playerLoop);
}).on("click", ".stick-btn", function (event) {
  event.preventDefault();
  $PLAYERCONTROLS.empty();
  dealerInitialTurn();
}).on("click", ".newgame", function (event) {
  event.preventDefault();
  $PLAYERCONTROLS.empty();
  startGame();
});

startGame();

// to start off the game, make a new game object (with attributes that will preserve the game's state, ie, who has what cards) and then
// ask the API for a deck ID to assign to the game object's deck (we need to use it for subsequent calls to the API, when we ask it for cards from
// our deck).
// We can't do anything until we have that deck ID, but the program would happily continue on prior to actually loading the object that contains the
// deck ID. So we need a way to make it wait until that object has successfully loaded-- we do so by making the next step in the program, which
// is the dealer's initial turn, fire as part of the setDeckID function's callback function. That way it won't happen until it has the requisite data.
function startGame() {
  game = new Game();
  $PLAYERCONTROLS.empty();
  $DEALERHAND.empty();
  $PLAYERHAND.empty();
  $MSGAREA.empty();
  setDeckId(playerInitialTurn);
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
      game.player_cards = game.player_cards.concat(obj.cards);
      insertPlayerCards(obj.cards);
      updateTotal("player");
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
  var total = acesToBack(cards).reduce(function (acc, card) {
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
    //flipDealerCards();
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash"));
    setTimeout(function () {
      $MSGAREA.append(make$P(" Dealer wins!").addClass("lose"));
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else if (game.dealertotal === 21 && game.dealer_cards.length === 2 && game.playerblackjack === true) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Double-blackjack!").removeClass("fadeIn").addClass("flash"));
    setTimeout(function () {
      $MSGAREA.append(make$P("Push!"));
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else if (game.playerblackjack === true) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash"));
    setTimeout(function () {
      $MSGAREA.append(make$P(" You win!").addClass("win"));
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else if (game.dealertotal > 21) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Dealer busts!"));
    setTimeout(function () {
      $MSGAREA.append(make$P(" You win!").addClass("win"));
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else {
    finalReckoning();
  }
}

// p. much the same thing for the player, except it's up to him/her whether or not to hit.
function playerInitialTurn() {
  dealCards("player", 2, playerLoop);
}

function playerLoop() {
  game.playerturn += 1;
  flipPlayerCards();
  if (game.playertotal === 21 && game.playerturn === 1) {
    game.playerblackjack = true;
    //$MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash")).append(make$P(" You win!").addClass("win"));
    //appendNewGameButton();
    appendControlsAndWait();
  } else {
    // } else if (game.playertotal > 21) {
    //   $PLAYERCONTROLS.empty();
    //   gameIsOverSoFlipAllCards();
    //   $MSGAREA.append(make$P("You busted!").removeClass("fadeIn").addClass("swing")).append(make$P(" You lose!").addClass("lose"));
    //   appendNewGameButton();
    // } else {
    appendControlsAndWait();
  }
}

function playerBusts() {
  $PLAYERCONTROLS.empty();
  $MSGAREA.append(make$P("You busted!").removeClass("fadeIn").addClass("swing"));
  setTimeout(function () {
    $MSGAREA.append(make$P(" You lose!").addClass("lose"));
  }, MSG_STAGGER);
  appendNewGameButton();
}

// if the neither the dealer nor the player won outright or busted during their respective turns, we need to compare the totals
// to see who won.
function finalReckoning() {
  $MSGAREA.append(make$P("Your total: " + game.playertotal).addClass("nomargin"));

  setTimeout(function () {
    $MSGAREA.append(make$P("Dealer's total: " + game.dealertotal).addClass("nomargin"));
  }, MSG_STAGGER);
  //$MSGAREA.append(make$P("&nbsp; &nbsp; Dealer's total: " + game.dealertotal).addClass("inline").addClass("hidden"));
  //setTimeout(function(){$(".msg-area p:last-child").removeClass("hidden");}, MSG_STAGGER);
  if (game.playertotal > game.dealertotal) {
    //flipDealerCards()
    setTimeout(function () {
      $MSGAREA.append(make$P("You win!").addClass("win").addClass("nomargin"));
    }, 2 * MSG_STAGGER);
    appendNewGameButton();
    gameIsOverSoFlipAllCards();
  } else if (game.playertotal === game.dealertotal) {
    //flipDealerCards()
    setTimeout(function () {
      $MSGAREA.append(make$P("Push!").addClass("nomargin"));
    }, 2 * MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else {
    //flipDealerCards()
    setTimeout(function () {
      $MSGAREA.append(make$P("You lose!").addClass("lose").addClass("nomargin"));
    }, 2 * MSG_STAGGER);
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
    if ($DEALERHAND.is(":empty") && i === 0) {
      var $card = generateFront$IMG(card_obj);
      $DEALERHAND.append($card);
    } else {
      var $card = generateBack$IMG(card_obj);
      $DEALERHAND.append($card);
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
}

function flipDealerCards() {
  var img_arr = [].slice.call(document.querySelectorAll(".dealer-hand img"));
  var i = 1;
  var length = img_arr.length;
  function delayedFlip() {

    // This code to have all of dealer's cards flip at once upon a game over.

    // img_arr.forEach(function(img) {
    //   if (img.getAttribute("front_url")) {
    //     img.src = img.getAttribute("front_url");
    //   }
    // })

    // uncomment below to make the dealer's cards all flip in a cascade
    // instead of all at once when the game ends (uncomment the above part too)

    if (i < length) {
      if (img_arr[i].getAttribute("front_url")) {
        img_arr[i].src = img_arr[i].getAttribute("front_url");
      }
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

function flipPlayerCards() {
  // if the player busts, don't want to spend any time waiting
  // to flip the card that led to the bust
  var img_arr = [].slice.call(document.querySelectorAll(".player-hand img"));
  var i = 0;
  var length = img_arr.length;
  function delayedFlip() {
    if (i < length) {
      if (img_arr[i].getAttribute("front_url") !== img_arr[i].getAttribute("src")) {
        var needThisForClosure = function (i) {
          var cardFlip = setTimeout(function () {
            img_arr[i].src = img_arr[i].getAttribute("front_url");
            if (game.playertotal > 21) {
              playerBusts();
              return;
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
//# sourceMappingURL=data:application/json;base64,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QyxJQUFJLENBQUMsQ0FBQztBQUNQLGVBQU87T0FDUjtBQUNELE9BQUMsSUFBSSxDQUFDLENBQUM7QUFDUCxpQkFBVyxFQUFFLENBQUM7S0FDZjtHQUNGO0FBQ0QsYUFBVyxFQUFFLENBQUM7Q0FDZjs7QUFFRCxTQUFTLHdCQUF3QixHQUFHO0FBQ2xDLGlCQUFlLEVBQUUsQ0FBQztBQUNsQixpQkFBZSxDQUFDLE9BQU8sQ0FBQyxVQUFTLEtBQUssRUFBRTtBQUN0QyxnQkFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0dBQ3JCLENBQUMsQ0FBQTtBQUNGLE1BQUksT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7QUFDM0UsU0FBTyxDQUFDLE9BQU8sQ0FBQyxVQUFTLElBQUksRUFBRTtBQUM3QixRQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLElBQUksSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUFDO0FBQ2hHLFVBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztLQUMzQztHQUNGLENBQUMsQ0FBQTtDQUNIIiwiZmlsZSI6InNyYy9qcy9tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsidmFyIEFQSV9VUkwgPSBcImh0dHA6Ly9kZWNrb2ZjYXJkc2FwaS5jb20vYXBpXCI7XG52YXIgQVBJX1BST1hZID0gXCJodHRwczovL2pzb25wLmFmZWxkLm1lLz91cmw9XCI7XG52YXIgZ2FtZTtcbnZhciBDQVJEX0JBQ0tfVVJMID0gXCJpbWFnZXMvYmFjay5wbmdcIjtcbnZhciAkREVBTEVSSEFORCA9ICQoJy5kZWFsZXItaGFuZCcpO1xudmFyICRQTEFZRVJIQU5EID0gJCgnLnBsYXllci1oYW5kJyk7XG52YXIgJFBMQVlFUkNPTlRST0xTID0gJCgnLnBsYXllci1jb250cm9scycpO1xudmFyICRERUFMRVJNU0cgPSAkKCcuZGVhbGVyLW1zZycpO1xudmFyICRQTEFZRVJNU0cgPSAkKCcucGxheWVyLW1zZycpO1xudmFyICRQTEFZRVJXUkFQUEVSID0gJCgnLnBsYXllci13cmFwcGVyJyk7XG52YXIgJE1TR0FSRUEgPSAkKCcubXNnLWFyZWEnKVxudmFyIGNhcmRmbGlwX2V2ZW50cyA9IFtdO1xudmFyIE1TR19TVEFHR0VSID0gNjAwO1xuXG4vLyB0aW1lIGJldHdlZW4gZGVhbGVyJ3MgY2FyZCBmbGlwcyB1cG9uIGEgZ2FtZSBvdmVyLlxudmFyIERFQUxFUl9DQVNDQURFX0ZMSVBfVElNRSA9IDE4MDtcblxuLy8gdGltZSBiZXR3ZWVuIGRlYWxlcidzIGluZGl2aWR1YWwgdHVybnNcbnZhciBERUFMRVJfVFVSTl9ERUxBWSA9IDE1MDA7XG5cbi8vIHRpbWUgYmV0d2VlbiBlYWNoIGluZGl2aWR1YWwgY2FyZCBmbGlwIG9uY2UgZmxpcHBpbmcgaGFzIGJlZ3VuXG52YXIgQ0FTQ0FERV9GTElQX1RJTUUgPSA0MDA7XG5cbiRQTEFZRVJXUkFQUEVSLm9uKCdjbGljaycsICcuaGl0LWJ0bicsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gIGRlYWxDYXJkcyhcInBsYXllclwiLCAxLCBwbGF5ZXJMb29wKTtcbn0pLm9uKCdjbGljaycsICcuc3RpY2stYnRuJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gIGRlYWxlckluaXRpYWxUdXJuKCk7XG59KS5vbignY2xpY2snLCAnLm5ld2dhbWUnLCBmdW5jdGlvbihldmVudCkge1xuICBldmVudC5wcmV2ZW50RGVmYXVsdCgpO1xuICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgc3RhcnRHYW1lKCk7XG59KVxuXG5zdGFydEdhbWUoKTtcblxuLy8gdG8gc3RhcnQgb2ZmIHRoZSBnYW1lLCBtYWtlIGEgbmV3IGdhbWUgb2JqZWN0ICh3aXRoIGF0dHJpYnV0ZXMgdGhhdCB3aWxsIHByZXNlcnZlIHRoZSBnYW1lJ3Mgc3RhdGUsIGllLCB3aG8gaGFzIHdoYXQgY2FyZHMpIGFuZCB0aGVuXG4vLyBhc2sgdGhlIEFQSSBmb3IgYSBkZWNrIElEIHRvIGFzc2lnbiB0byB0aGUgZ2FtZSBvYmplY3QncyBkZWNrICh3ZSBuZWVkIHRvIHVzZSBpdCBmb3Igc3Vic2VxdWVudCBjYWxscyB0byB0aGUgQVBJLCB3aGVuIHdlIGFzayBpdCBmb3IgY2FyZHMgZnJvbVxuLy8gb3VyIGRlY2spLlxuLy8gV2UgY2FuJ3QgZG8gYW55dGhpbmcgdW50aWwgd2UgaGF2ZSB0aGF0IGRlY2sgSUQsIGJ1dCB0aGUgcHJvZ3JhbSB3b3VsZCBoYXBwaWx5IGNvbnRpbnVlIG9uIHByaW9yIHRvIGFjdHVhbGx5IGxvYWRpbmcgdGhlIG9iamVjdCB0aGF0IGNvbnRhaW5zIHRoZVxuLy8gZGVjayBJRC4gU28gd2UgbmVlZCBhIHdheSB0byBtYWtlIGl0IHdhaXQgdW50aWwgdGhhdCBvYmplY3QgaGFzIHN1Y2Nlc3NmdWxseSBsb2FkZWQtLSB3ZSBkbyBzbyBieSBtYWtpbmcgdGhlIG5leHQgc3RlcCBpbiB0aGUgcHJvZ3JhbSwgd2hpY2hcbi8vIGlzIHRoZSBkZWFsZXIncyBpbml0aWFsIHR1cm4sIGZpcmUgYXMgcGFydCBvZiB0aGUgc2V0RGVja0lEIGZ1bmN0aW9uJ3MgY2FsbGJhY2sgZnVuY3Rpb24uIFRoYXQgd2F5IGl0IHdvbid0IGhhcHBlbiB1bnRpbCBpdCBoYXMgdGhlIHJlcXVpc2l0ZSBkYXRhLlxuZnVuY3Rpb24gc3RhcnRHYW1lKCkge1xuICBnYW1lID0gbmV3IEdhbWUoKTtcbiAgJFBMQVlFUkNPTlRST0xTLmVtcHR5KCk7XG4gICRERUFMRVJIQU5ELmVtcHR5KCk7XG4gICRQTEFZRVJIQU5ELmVtcHR5KCk7XG4gICRNU0dBUkVBLmVtcHR5KCk7XG4gIHNldERlY2tJZChwbGF5ZXJJbml0aWFsVHVybik7XG59XG5cbi8vIHNldHRpbmcgdXAgYSBnYW1lIG9iamVjdCB0byBwcmVzZXJ2ZSB0aGUgZ2FtZSdzIHN0YXRlLiBUaGlzIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gdGhhdCBpcyBpbnZva2VkIGFib3ZlIHZpYSBcImdhbWUgPSBuZXcgR2FtZSgpO1wiIHRvXG4vLyBnZW5lcmF0ZSBhIGdhbWUgb2JqZWN0IHdpdGggYWxsIG9mIHRoZSBhdHRyaWJ1dGVzIGxpc3RlZCBiZWxvdy5cbmZ1bmN0aW9uIEdhbWUoKSB7XG4gIHRoaXMuZGVja19pZCA9IFwiXCI7XG4gIHRoaXMuZGVhbGVyX2NhcmRzID0gW107XG4gIHRoaXMucGxheWVyX2NhcmRzID0gW107XG4gIHRoaXMucGxheWVydG90YWwgPSAwO1xuICB0aGlzLmRlYWxlcnRvdGFsID0gMDtcbiAgdGhpcy5wbGF5ZXJ0dXJuID0gMDtcbiAgdGhpcy5wbGF5ZXJibGFja2phY2sgPSBmYWxzZTtcbn1cblxuLy8gc2V0IHRoZSB0aGUgZ2FtZSBvYmplY3QncyBkZWNrX2lkIGJ5IGNhbGxpbmcgdGhlIEFQSSBhbmQgbG9va2luZyBhdCB0aGUgZGVja19pZCBhdHRyaWJ1dGUgb2YgdGhlIHJlc3BvbnNlIGl0IGdpdmVzIHVzLlxuLy8gQWZ0ZXIgdGhlIGRhdGEgaGFzIGxvYWRlZCAoYW5kIHdyaXR0ZW4gdG8gdGhlIGdhbWUgb2JqZWN0KSwgb3VyIGNhbGxiYWNrIGZ1bmN0aW9uIGZpcmVzIG9mZiwgd2hpY2ggd2UndmUgc2V0IHVwIHRvIGJlIHdoYXRldmVyIGZ1bmN0aW9uIHdlIHBhc3MgaW4uXG4vLyBXZSBwYXNzIGluIHBsYXllckluaXRpYWxUdXJuIChsaW5lIDQ0KSBzbyB0aGF0IHRoZSBnYW1lIHN0YXJ0cy5cblxuZnVuY3Rpb24gc2V0RGVja0lkKGNhbGxiYWNrKSB7XG4gICQuZ2V0KEFQSV9QUk9YWSArIEFQSV9VUkwgKyBcIi9zaHVmZmxlLz9kZWNrX2NvdW50PTZcIiwgZnVuY3Rpb24ob2JqKXtcbiAgICBnYW1lLmRlY2tfaWQgPSBvYmouZGVja19pZDtcbiAgICBjYWxsYmFjaygpO1xuICB9LCAnanNvbicpO1xufVxuXG4vLyBzcGVjaWZ5IFwicGxheWVyXCIgb3IgXCJkZWFsZXJcIiBhbmQgaG93IG1hbnkgY2FyZHMuIFRoZWlyIGFycmF5IHdpbGwgYmUgcG9wdWxhdGVkIHdpdGggdGhlIGNhcmRzICh2aWEgYXJyYXkgY29uY2F0ZW5hdGlvbilcbi8vIGFuZCB0aGUgdG90YWwgdXBkYXRlZCAod2lsbCBtYWtlIEFjZXMgd29ydGhcbi8vIDEgaW5zdGVhZCBvZiAxMSBpZiBpdCB3aWxsIHByZXZlbnQgYnVzdGluZzsgc2VlIHN1YnNlcXVlbnQgZnVuY3Rpb25zIGZvciBkZXRhaWxzIG9uIGhvdyB0aGlzIGhhcHBlbnMuXG4vLyBodHRwOi8vZGVja29mY2FyZHNhcGkuY29tLyBzaG93cyB3aGF0IHRoZSByZXNwb25zZSBvYmplY3QgbG9va3MgbGlrZTsgY2hlY2sgdW5kZXIgXCJkcmF3IGEgY2FyZFwiLlxuZnVuY3Rpb24gZGVhbENhcmRzKHRvd2hvbSwgbnVtLCBjYWxsYmFjaykge1xuICB2YXIgZ2V0X3VybCA9IEFQSV9QUk9YWSArIEFQSV9VUkwgKyBcIi9kcmF3L1wiICsgZ2FtZS5kZWNrX2lkICsgXCIvP2NvdW50PVwiICsgbnVtO1xuICAkLmdldChnZXRfdXJsLCBmdW5jdGlvbihvYmope1xuICAgIGlmICh0b3dob20udG9Mb3dlckNhc2UoKSA9PT0gXCJwbGF5ZXJcIikge1xuICAgICAgZ2FtZS5wbGF5ZXJfY2FyZHMgPSBnYW1lLnBsYXllcl9jYXJkcy5jb25jYXQob2JqLmNhcmRzKTtcbiAgICAgIGluc2VydFBsYXllckNhcmRzKG9iai5jYXJkcyk7XG4gICAgICB1cGRhdGVUb3RhbChcInBsYXllclwiKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBnYW1lLmRlYWxlcl9jYXJkcyA9IGdhbWUuZGVhbGVyX2NhcmRzLmNvbmNhdChvYmouY2FyZHMpO1xuICAgICAgaW5zZXJ0RGVhbGVyQ2FyZHMob2JqLmNhcmRzKTtcbiAgICAgIHVwZGF0ZVRvdGFsKFwiZGVhbGVyXCIpO1xuICAgIH1cbiAgICBjYWxsYmFjaygpO1xuICB9LCAnanNvbicpO1xufVxuXG4vLyBlbnRlciBcInBsYXllclwiIG9yIFwiZGVhbGVyXCIuIEl0IHdpbGwgc3VtIHVwIHRoZSB0b3RhbCBvZiB0aGUgY2FyZHMsXG4vLyB3aXRoIGFjZXMgbW92ZWQgdG8gdGhlIGJhY2sgc28gdGhhdCB0aGUgY29tcHV0ZXIgY2FuIGRlY2lkZSB0byBjb3VudCB0aGVtIGFzXG4vLyAxIGlmIGl0IHdpbGwgcHJldmVudCBidXN0aW5nLiBUaGUgbmV3IHRvdGFsIGlzIHdyaXR0ZW4gdG8gdGhlIGdhbWUgb2JqZWN0LiBUaGlzIGRvZXNuJ3QgbW9kaWZ5IHRoZSBvcmlnaW5hbFxuLy8gY2FyZCBvcmRlcjsgZG9uJ3Qgd2FudCB0byBkbyB0aGF0LCBiZWNhdXNlIHdlIHdhbnQgdG8ga2VlcCB0aGUgb3JkZXIgZm9yIGRpc3BsYXkgcHVycG9zZXMuXG4vLyBzbyBkb2luZyAuc2xpY2UoKSBvbiB0aGUgY2FyZCBhcnJheXMgd2lsbCBsZXQgdXMgbWFrZSB0aGUgYWNlc1RvQmFjay1lZCBhcnJheXMgZnJvbSBjb3BpZXMuXG5mdW5jdGlvbiB1cGRhdGVUb3RhbCh3aG9tKSB7XG4gIHZhciBjYXJkcyA9IHdob20udG9Mb3dlckNhc2UoKSA9PT0gXCJwbGF5ZXJcIiA/IGdhbWUucGxheWVyX2NhcmRzLnNsaWNlKCkgOiBnYW1lLmRlYWxlcl9jYXJkcy5zbGljZSgpO1xuICB2YXIgdG90YWwgPVxuICBhY2VzVG9CYWNrKGNhcmRzKS5yZWR1Y2UoZnVuY3Rpb24oYWNjLCBjYXJkKSB7XG4gICAgaWYgKGNhcmQudmFsdWUgPT09IFwiS0lOR1wiIHx8IGNhcmQudmFsdWUgPT09IFwiUVVFRU5cIiB8fCBjYXJkLnZhbHVlID09PSBcIkpBQ0tcIikge1xuICAgICAgcmV0dXJuIGFjYyArIDEwO1xuICAgIH1cbiAgICBlbHNlIGlmIChjYXJkLnZhbHVlID09PSBcIkFDRVwiKSB7XG4gICAgICBpZiAoYWNjICsgMTEgPCAyMikge3JldHVybiBhY2MgKyAxMX1cbiAgICAgIGVsc2Uge3JldHVybiBhY2MgKyAxfVxuICAgIH1cbiAgICBlbHNlIHtyZXR1cm4gYWNjICsgcGFyc2VJbnQoY2FyZC52YWx1ZSl9XG4gIH0sIDApXG4gIHdob20udG9Mb3dlckNhc2UoKSA9PT0gXCJwbGF5ZXJcIiA/IChnYW1lLnBsYXllcnRvdGFsID0gdG90YWwpIDogKGdhbWUuZGVhbGVydG90YWwgPSB0b3RhbCk7XG59XG5cbi8vIGFjZXMgdG8gYmFjayBvZiBhcnJheSBmb3Igc3VtbWF0aW9uIHB1cnBvc2VzLlxuLy8gTG9vayBhdCBhbGwgY2FyZHM7IGFjZT8gSWYgc28gbW92ZSBpdCB0byB0aGUgYmFjay4gTm90IGFjZT8gTW92ZSBpdCB0byB0aGUgZnJvbnQuXG5mdW5jdGlvbiBhY2VzVG9CYWNrKGFycikge1xuICB2YXIgcmV0dXJuX2FyciA9IFtdO1xuICBhcnIuZm9yRWFjaChmdW5jdGlvbihjYXJkKSB7XG4gICAgaWYgKGNhcmQudmFsdWUgPT09IFwiQUNFXCIpIHtyZXR1cm5fYXJyLnB1c2goY2FyZCl9XG4gICAgZWxzZSB7cmV0dXJuX2Fyci51bnNoaWZ0KGNhcmQpfVxuICB9KVxuICByZXR1cm4gcmV0dXJuX2Fycjtcbn1cblxuLy8gRGVhbGVyJ3MgZmlyc3QgdHVybi4gRGVhbCAyIGNhcmRzIHRvIHRoZSBkZWFsZXIsIGFuZCBhZnRlciB0aGUgZGF0YSBpcyBsb2FkZWQsIGludm9rZSBkZWFsZXJMb29wIGFzIHRoZSBjYWxsYmFjayBmdW5jdGlvbi5cbi8vIE5vdGUgdGhhdCB0aGUgcGxheWVyIGFjdHVhbGx5IGdvZXMgZmlyc3Q7IGNvZGUgaXMgaW4gdGhpcyBvcmRlciBiZWNhdXNlIEkgZ290IHRoYXQgd3JvbmcgYXQgZmlyc3QuXG5mdW5jdGlvbiBkZWFsZXJJbml0aWFsVHVybigpIHtcbiAgZGVhbENhcmRzKFwiZGVhbGVyXCIsIDIsIGRlYWxlckxvb3ApO1xufVxuXG4vLyBNYWtlIGRlYWxlcidzIHR1cm5zIGdvIHNsb3dlciAoaWUsIG5vdCBpbnN0YW50YW5lb3VzbHkpIHNvIHRoYXQgaXQgZmVlbHMgbGlrZSBhIGNhcmQgZ2FtZSBpcyBhY3R1YWxseSBiZWluZyBwbGF5ZWQgb3V0O1xuLy8gZG8gc28gYnkgc2V0dGluZyBhIHRpbWVvdXQgb24gZWFjaCBzdWJzZXF1ZW50IGZ1bmN0aW9uIGNhbGwgKGllLCBlYWNoICpuZXh0KiBkZWFsZXIgdHVybikgdGhhdCBkZWxheXMgdGhhdCBuZXh0IHR1cm4gYnlcbi8vIERFQUxFUl9UVVJOX0RFTEFZIG1pbGxpc2Vjb25kczsgYWRqdXN0IHRoaXMgY29uc3RhbnQgZnJvbSB0aGUgdG9wIG9mIHRoaXMgZmlsZS5cbmZ1bmN0aW9uIGRlYWxlckxvb3AoKSB7XG4gIGlmIChnYW1lLmRlYWxlcnRvdGFsIDwgMTcpIHtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge2RlYWxDYXJkcyhcImRlYWxlclwiLCAxLCBkZWFsZXJMb29wKX0sIERFQUxFUl9UVVJOX0RFTEFZKTtcbiAgfSBlbHNlIHtcbiAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge2RlYWxlclR1cm5SZXN1bHQoKX0sIERFQUxFUl9UVVJOX0RFTEFZKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBtYWtlJFAoc3RyaW5nKSB7XG4gIHJldHVybiAoJChcIjxwPlwiICsgc3RyaW5nICsgXCI8L3A+XCIpLmFkZENsYXNzKFwiYW5pbWF0ZWQgZmFkZUluXCIpKTtcbn1cblxuZnVuY3Rpb24gZGVhbGVyVHVyblJlc3VsdCgpIHtcbiAgaWYgKGdhbWUuZGVhbGVydG90YWwgPT09IDIxICYmIGdhbWUuZGVhbGVyX2NhcmRzLmxlbmd0aCA9PT0gMiAmJiBnYW1lLnBsYXllcmJsYWNramFjayA9PT0gZmFsc2UpIHtcbiAgICAvL2ZsaXBEZWFsZXJDYXJkcygpO1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJCbGFja2phY2shXCIpLnJlbW92ZUNsYXNzKFwiZmFkZUluXCIpLmFkZENsYXNzKFwiZmxhc2hcIikpO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCIgRGVhbGVyIHdpbnMhXCIpLmFkZENsYXNzKFwibG9zZVwiKSlcbiAgICB9LCBNU0dfU1RBR0dFUik7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9XG4gIGVsc2UgaWYgKGdhbWUuZGVhbGVydG90YWwgPT09IDIxICYmIGdhbWUuZGVhbGVyX2NhcmRzLmxlbmd0aCA9PT0gMiAmJiBnYW1lLnBsYXllcmJsYWNramFjayA9PT0gdHJ1ZSkge1xuICAgIC8vZmxpcERlYWxlckNhcmRzKCk7XG4gICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIkRvdWJsZS1ibGFja2phY2shXCIpLnJlbW92ZUNsYXNzKFwiZmFkZUluXCIpLmFkZENsYXNzKFwiZmxhc2hcIikpO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJQdXNoIVwiKSk7XG4gICAgfSwgTVNHX1NUQUdHRVIpO1xuICAgIGdhbWVJc092ZXJTb0ZsaXBBbGxDYXJkcygpO1xuICAgIGFwcGVuZE5ld0dhbWVCdXR0b24oKTtcbiAgfVxuICBlbHNlIGlmIChnYW1lLnBsYXllcmJsYWNramFjayA9PT0gdHJ1ZSkge1xuICAgIC8vZmxpcERlYWxlckNhcmRzKCk7XG4gICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIkJsYWNramFjayFcIikucmVtb3ZlQ2xhc3MoXCJmYWRlSW5cIikuYWRkQ2xhc3MoXCJmbGFzaFwiKSk7XG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpe1xuICAgICAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIiBZb3Ugd2luIVwiKS5hZGRDbGFzcyhcIndpblwiKSk7XG4gICAgfSwgTVNHX1NUQUdHRVIpO1xuICAgIGdhbWVJc092ZXJTb0ZsaXBBbGxDYXJkcygpO1xuICAgIGFwcGVuZE5ld0dhbWVCdXR0b24oKTtcbiAgfVxuICBlbHNlIGlmIChnYW1lLmRlYWxlcnRvdGFsID4gMjEpIHtcbiAgICAvL2ZsaXBEZWFsZXJDYXJkcygpO1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJEZWFsZXIgYnVzdHMhXCIpKVxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7XG4gICAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiIFlvdSB3aW4hXCIpLmFkZENsYXNzKFwid2luXCIpKTtcbiAgICB9LCBNU0dfU1RBR0dFUik7XG4gICAgZ2FtZUlzT3ZlclNvRmxpcEFsbENhcmRzKCk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9IGVsc2Uge1xuICAgIGZpbmFsUmVja29uaW5nKCk7XG4gIH1cbn1cblxuLy8gcC4gbXVjaCB0aGUgc2FtZSB0aGluZyBmb3IgdGhlIHBsYXllciwgZXhjZXB0IGl0J3MgdXAgdG8gaGltL2hlciB3aGV0aGVyIG9yIG5vdCB0byBoaXQuXG5mdW5jdGlvbiBwbGF5ZXJJbml0aWFsVHVybigpIHtcbiAgZGVhbENhcmRzKFwicGxheWVyXCIsIDIsIHBsYXllckxvb3ApO1xufVxuXG5mdW5jdGlvbiBwbGF5ZXJMb29wKCkge1xuICBnYW1lLnBsYXllcnR1cm4gKz0gMTtcbiAgZmxpcFBsYXllckNhcmRzKCk7XG4gIGlmIChnYW1lLnBsYXllcnRvdGFsID09PSAyMSAmJiBnYW1lLnBsYXllcnR1cm4gPT09IDEpIHtcbiAgICBnYW1lLnBsYXllcmJsYWNramFjayA9IHRydWU7XG4gICAgLy8kTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiQmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKS5hcHBlbmQobWFrZSRQKFwiIFlvdSB3aW4hXCIpLmFkZENsYXNzKFwid2luXCIpKTtcbiAgICAvL2FwcGVuZE5ld0dhbWVCdXR0b24oKTtcbiAgICBhcHBlbmRDb250cm9sc0FuZFdhaXQoKTtcbiAgfSBlbHNlIHtcbiAgLy8gfSBlbHNlIGlmIChnYW1lLnBsYXllcnRvdGFsID4gMjEpIHtcbiAgLy8gICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgLy8gICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgLy8gICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiWW91IGJ1c3RlZCFcIikucmVtb3ZlQ2xhc3MoXCJmYWRlSW5cIikuYWRkQ2xhc3MoXCJzd2luZ1wiKSkuYXBwZW5kKG1ha2UkUChcIiBZb3UgbG9zZSFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpKTtcbiAgLy8gICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIC8vIH0gZWxzZSB7XG4gICAgYXBwZW5kQ29udHJvbHNBbmRXYWl0KCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gcGxheWVyQnVzdHMoKSB7XG4gICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiWW91IGJ1c3RlZCFcIikucmVtb3ZlQ2xhc3MoXCJmYWRlSW5cIikuYWRkQ2xhc3MoXCJzd2luZ1wiKSk7XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiIFlvdSBsb3NlIVwiKS5hZGRDbGFzcyhcImxvc2VcIikpO1xuICB9LCBNU0dfU1RBR0dFUik7XG4gIGFwcGVuZE5ld0dhbWVCdXR0b24oKTtcbn1cblxuLy8gaWYgdGhlIG5laXRoZXIgdGhlIGRlYWxlciBub3IgdGhlIHBsYXllciB3b24gb3V0cmlnaHQgb3IgYnVzdGVkIGR1cmluZyB0aGVpciByZXNwZWN0aXZlIHR1cm5zLCB3ZSBuZWVkIHRvIGNvbXBhcmUgdGhlIHRvdGFsc1xuLy8gdG8gc2VlIHdobyB3b24uXG5mdW5jdGlvbiBmaW5hbFJlY2tvbmluZygpIHtcbiAgJE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIllvdXIgdG90YWw6IFwiICsgZ2FtZS5wbGF5ZXJ0b3RhbCkuYWRkQ2xhc3MoXCJub21hcmdpblwiKSk7XG4gIFxuICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7JE1TR0FSRUEuYXBwZW5kKG1ha2UkUChcIkRlYWxlcidzIHRvdGFsOiBcIiArIGdhbWUuZGVhbGVydG90YWwpLmFkZENsYXNzKFwibm9tYXJnaW5cIikpfSwgTVNHX1NUQUdHRVIpO1xuICAvLyRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCImbmJzcDsgJm5ic3A7IERlYWxlcidzIHRvdGFsOiBcIiArIGdhbWUuZGVhbGVydG90YWwpLmFkZENsYXNzKFwiaW5saW5lXCIpLmFkZENsYXNzKFwiaGlkZGVuXCIpKTtcbiAgLy9zZXRUaW1lb3V0KGZ1bmN0aW9uKCl7JChcIi5tc2ctYXJlYSBwOmxhc3QtY2hpbGRcIikucmVtb3ZlQ2xhc3MoXCJoaWRkZW5cIik7fSwgTVNHX1NUQUdHRVIpO1xuICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IGdhbWUuZGVhbGVydG90YWwpIHtcbiAgICAvL2ZsaXBEZWFsZXJDYXJkcygpXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpIHskTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiWW91IHdpbiFcIikuYWRkQ2xhc3MoXCJ3aW5cIikuYWRkQ2xhc3MoXCJub21hcmdpblwiKSk7fSwgMipNU0dfU1RBR0dFUik7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICAgIGdhbWVJc092ZXJTb0ZsaXBBbGxDYXJkcygpO1xuICB9IGVsc2UgaWYgKGdhbWUucGxheWVydG90YWwgPT09IGdhbWUuZGVhbGVydG90YWwpIHtcbiAgICAvL2ZsaXBEZWFsZXJDYXJkcygpXG4gICAgc2V0VGltZW91dChmdW5jdGlvbigpeyRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJQdXNoIVwiKS5hZGRDbGFzcyhcIm5vbWFyZ2luXCIpKTt9LCAyKk1TR19TVEFHR0VSKTtcbiAgICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH0gZWxzZSB7XG4gICAgLy9mbGlwRGVhbGVyQ2FyZHMoKVxuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXskTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiWW91IGxvc2UhXCIpLmFkZENsYXNzKFwibG9zZVwiKS5hZGRDbGFzcyhcIm5vbWFyZ2luXCIpKTt9LCAyKk1TR19TVEFHR0VSKTtcbiAgICBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0UGxheWVyQ2FyZHMoY2FyZF9hcnIpIHtcbiAgY2FyZF9hcnIuZm9yRWFjaChmdW5jdGlvbihjYXJkX29iaikge1xuICAgIHZhciAkY2FyZCA9IGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopO1xuICAgICRQTEFZRVJIQU5ELmFwcGVuZCgkY2FyZCk7XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRnJvbnQkSU1HKGNhcmRfb2JqKSB7XG4gIGlmIChjYXJkX29iai52YWx1ZSA9PT0gXCJBQ0VcIiAmJiBjYXJkX29iai5zdWl0ID09PSBcIkRJQU1PTkRTXCIpe1xuICAgIGNhcmRfb2JqLmltYWdlID0gXCJpbWFnZXMvQWNlT2ZEaWFtb25kcy5wbmdcIjtcbiAgfVxuICB2YXIgJGNhcmQgPSAkKFwiPGltZyBzcmM9J1wiICsgY2FyZF9vYmouaW1hZ2UgKyBcIic+XCIpO1xuICByZXR1cm4gJGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopIHtcbiAgaWYgKGNhcmRfb2JqLnZhbHVlID09PSBcIkFDRVwiICYmIGNhcmRfb2JqLnN1aXQgPT09IFwiRElBTU9ORFNcIil7XG4gICAgY2FyZF9vYmouaW1hZ2UgPSBcImltYWdlcy9BY2VPZkRpYW1vbmRzLnBuZ1wiO1xuICB9XG4gIHZhciAkY2FyZCA9ICQoXCI8aW1nIHNyYz0nXCIgKyBDQVJEX0JBQ0tfVVJMICsgXCInIGZyb250X3VybCA9ICdcIiArIGNhcmRfb2JqLmltYWdlICsgXCInPlwiKTtcbiAgcmV0dXJuICRjYXJkO1xufVxuXG5mdW5jdGlvbiBpbnNlcnREZWFsZXJDYXJkcyhjYXJkX2Fycikge1xuICBjYXJkX2Fyci5mb3JFYWNoKGZ1bmN0aW9uKGNhcmRfb2JqLCBpKSB7XG4gICAgaWYgKCRERUFMRVJIQU5ELmlzKCc6ZW1wdHknKSAmJiBpID09PSAwKSB7XG4gICAgICB2YXIgJGNhcmQgPSBnZW5lcmF0ZUZyb250JElNRyhjYXJkX29iaik7XG4gICAgICAkREVBTEVSSEFORC5hcHBlbmQoJGNhcmQpO1xuICAgIH0gZWxzZSB7XG4gICAgICB2YXIgJGNhcmQgPSBnZW5lcmF0ZUJhY2skSU1HKGNhcmRfb2JqKTtcbiAgICAgICRERUFMRVJIQU5ELmFwcGVuZCgkY2FyZCk7XG4gICAgfVxuICB9KVxufVxuXG4vLyBhcHBlbmQgY29udHJvbHMgYW5kIGF3YWl0IHBsYXllciBkZWNpc2lvblxuZnVuY3Rpb24gYXBwZW5kQ29udHJvbHNBbmRXYWl0KCkge1xuICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgaWYgKGdhbWUucGxheWVydG90YWwgIT09IDIxKSB7XG4gICAgdmFyICRoaXQgPSAkKFwiPGJ1dHRvbiBjbGFzcz0naGl0LWJ0bic+SGl0PC9idXR0b24+XCIpO1xuICAgICRQTEFZRVJDT05UUk9MUy5hcHBlbmQoJGhpdCk7XG4gIH1cbiAgdmFyICRzdGljayA9ICQoXCI8YnV0dG9uIGNsYXNzPSdzdGljay1idG4nPlN0YW5kPC9idXR0b24+XCIpO1xuICAkUExBWUVSQ09OVFJPTFMuYXBwZW5kKCRzdGljayk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZE5ld0dhbWVCdXR0b24oKSB7XG4gICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICB2YXIgJG5ld2dhbWUgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nbmV3Z2FtZSc+TmV3IEdhbWU8L2J1dHRvbj5cIik7XG4gICRQTEFZRVJDT05UUk9MUy5hcHBlbmQoJG5ld2dhbWUpO1xufVxuXG5mdW5jdGlvbiBmbGlwRGVhbGVyQ2FyZHMoKSB7XG4gIHZhciBpbWdfYXJyID0gW10uc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmRlYWxlci1oYW5kIGltZ1wiKSk7XG4gIHZhciBpID0gMTtcbiAgdmFyIGxlbmd0aCA9IGltZ19hcnIubGVuZ3RoO1xuICBmdW5jdGlvbiBkZWxheWVkRmxpcCgpIHtcblxuICAgIC8vIFRoaXMgY29kZSB0byBoYXZlIGFsbCBvZiBkZWFsZXIncyBjYXJkcyBmbGlwIGF0IG9uY2UgdXBvbiBhIGdhbWUgb3Zlci5cblxuICAgIC8vIGltZ19hcnIuZm9yRWFjaChmdW5jdGlvbihpbWcpIHtcbiAgICAvLyAgIGlmIChpbWcuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpKSB7XG4gICAgLy8gICAgIGltZy5zcmMgPSBpbWcuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpO1xuICAgIC8vICAgfVxuICAgIC8vIH0pXG5cbiAgICAvLyB1bmNvbW1lbnQgYmVsb3cgdG8gbWFrZSB0aGUgZGVhbGVyJ3MgY2FyZHMgYWxsIGZsaXAgaW4gYSBjYXNjYWRlXG4gICAgLy8gaW5zdGVhZCBvZiBhbGwgYXQgb25jZSB3aGVuIHRoZSBnYW1lIGVuZHMgKHVuY29tbWVudCB0aGUgYWJvdmUgcGFydCB0b28pXG5cbiAgICBpZiAoaSA8IGxlbmd0aCkge1xuICAgICAgaWYgKGltZ19hcnJbaV0uZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpKSB7XG4gICAgICAgIGltZ19hcnJbaV0uc3JjID0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIik7XG4gICAgICB9XG4gICAgICBpICs9IDE7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ZGVsYXllZEZsaXAoKX0sIERFQUxFUl9DQVNDQURFX0ZMSVBfVElNRSk7XG4gICAgfVxuICB9XG4gIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtkZWxheWVkRmxpcCgpO30sIERFQUxFUl9DQVNDQURFX0ZMSVBfVElNRSk7XG59XG5cbmZ1bmN0aW9uIGZsaXBQbGF5ZXJDYXJkcygpIHtcbiAgLy8gaWYgdGhlIHBsYXllciBidXN0cywgZG9uJ3Qgd2FudCB0byBzcGVuZCBhbnkgdGltZSB3YWl0aW5nXG4gIC8vIHRvIGZsaXAgdGhlIGNhcmQgdGhhdCBsZWQgdG8gdGhlIGJ1c3RcbiAgdmFyIGltZ19hcnIgPSBbXS5zbGljZS5jYWxsKGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGwoXCIucGxheWVyLWhhbmQgaW1nXCIpKTtcbiAgdmFyIGkgPSAwO1xuICB2YXIgbGVuZ3RoID0gaW1nX2Fyci5sZW5ndGg7XG4gIGZ1bmN0aW9uIGRlbGF5ZWRGbGlwKCkge1xuICAgIGlmIChpIDwgbGVuZ3RoKSB7XG4gICAgICBpZiAoaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIikgIT09IGltZ19hcnJbaV0uZ2V0QXR0cmlidXRlKFwic3JjXCIpKXtcbiAgICAgICAgZnVuY3Rpb24gbmVlZFRoaXNGb3JDbG9zdXJlKGkpe1xuICAgICAgICAgIHZhciBjYXJkRmxpcCA9IHNldFRpbWVvdXQoZnVuY3Rpb24oKXtcbiAgICAgICAgICAgIGltZ19hcnJbaV0uc3JjID0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIik7XG4gICAgICAgICAgICBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IDIxKSB7XG4gICAgICAgICAgICAgIHBsYXllckJ1c3RzKCk7XG4gICAgICAgICAgICAgIHJldHVyblxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZGVsYXllZEZsaXAoKTtcbiAgICAgICAgICB9LCBDQVNDQURFX0ZMSVBfVElNRSk7XG4gICAgICAgICAgY2FyZGZsaXBfZXZlbnRzLnB1c2goY2FyZEZsaXApO1xuICAgICAgICB9XG4gICAgICAgIG5lZWRUaGlzRm9yQ2xvc3VyZShpKTtcbiAgICAgICAgaSArPSAxO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBpICs9IDE7XG4gICAgICBkZWxheWVkRmxpcCgpO1xuICAgIH1cbiAgfVxuICBkZWxheWVkRmxpcCgpO1xufVxuXG5mdW5jdGlvbiBnYW1lSXNPdmVyU29GbGlwQWxsQ2FyZHMoKSB7XG4gIGZsaXBEZWFsZXJDYXJkcygpO1xuICBjYXJkZmxpcF9ldmVudHMuZm9yRWFjaChmdW5jdGlvbihldmVudCkge1xuICAgIGNsZWFyVGltZW91dChldmVudCk7XG4gIH0pXG4gIHZhciBpbWdfYXJyID0gW10uc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLnBsYXllci1oYW5kIGltZ1wiKSk7XG4gIGltZ19hcnIuZm9yRWFjaChmdW5jdGlvbihjYXJkKSB7XG4gICAgaWYgKGNhcmQuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpICYmIGNhcmQuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpICE9PSBjYXJkLmdldEF0dHJpYnV0ZShcInNyY1wiKSl7XG4gICAgICBjYXJkLnNyYyA9IGNhcmQuZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpO1xuICAgIH1cbiAgfSlcbn1cbiJdfQ==