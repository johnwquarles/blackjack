"use strict";

var API_URL = "http://deckofcardsapi.com/api";
var API_PROXY = "https://jsonp.afeld.me/?url=";
var game;
var CARD_BACK_URL = "/images/back.png";
var $DEALERHAND = $(".dealer-hand");
var $PLAYERHAND = $(".player-hand");
var $PLAYERCONTROLS = $(".player-controls");
var $DEALERMSG = $(".dealer-msg");
var $PLAYERMSG = $(".player-msg");
var $PLAYERWRAPPER = $(".player-wrapper");
var $MSGAREA = $(".msg-area");

// time between dealer's individual turns
var DEALER_TURN_DELAY = 1500;

// time between each individual card flip once flipping has begun
var CASCADE_FLIP_TIME = 400;

$PLAYERWRAPPER.on("click", ".hit-btn", function (event) {
  event.preventDefault();
  dealCards("player", 1, playerLoop);
}).on("click", ".stick-btn", function (event) {
  event.preventDefault();
  dealerInitialTurn();
}).on("click", ".newgame", function (event) {
  event.preventDefault();
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
  //$PLAYERMSG.empty();
  //$DEALERMSG.empty();
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
  // this.dealerFirstTurn = true;
}

// set the the game object's deck_id by calling the API and looking at the deck_id attribute of the response it gives us.
// After the data has loaded (and written to the game object), our callback function fires off, which we've set up to be whatever function we pass in.
// We pass in dealerInitialTurn (line 15) so that the game starts.

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
      //appendTotal("player");
    } else {
      game.dealer_cards = game.dealer_cards.concat(obj.cards);
      insertDealerCards(obj.cards);
      updateTotal("dealer");
      //appendTotal("dealer");
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

// First turn. Deal 2 cards to the dealer, and after the data is loaded, invoke dealerLoop as the callback function.
function dealerInitialTurn() {
  dealCards("dealer", 2, dealerLoop);
}

// Tell player what the dealer's first card is (only on the first time, otherwise it's annoying).
// Have the dealer keep hitting (by calling this function again) until he reaches 17 or more; once he does,
// see where he/she stands.
function dealerLoop() {
  // if (game.dealerFirstTurn){
  // alert("Dealer's first card : " + game.dealer_cards[0].value + " of " + game.dealer_cards[0].suit);
  // game.dealerFirstTurn = false;
  // }
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

// turn the card array into something we can display (by during each card object into a string including its value and suit).
// Then display the appropriate message.
function make$P(string) {
  return $("<p>" + string + "</p>").addClass("animated fadeIn");
}

function dealerTurnResult() {
  var dealer_hand = game.dealer_cards.map(function (card) {
    return " " + card.value + " of " + card.suit;
  });
  if (game.dealertotal === 21) {
    // alert("Dealer's hand: " + dealer_hand + "\n\nBlackjack! Dealer wins!");
    flipDealerCards();
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash")).append(make$P(" Dealer wins!").addClass("lose"));
    appendNewGameButton();
    // newGamePrompt();
  } else if (game.dealertotal > 21) {
    // alert("Dealer's hand: " + dealer_hand + "\n\nDealer busts! So you win!");
    flipDealerCards();
    $MSGAREA.append(make$P("Dealer busts!")).append(make$P(" You win!").addClass("win"));
    appendNewGameButton();
    // ---> flip the dealer's cards over now <---
    // newGamePrompt();
  } else {
    // alert("player's turn")
    finalReckoning();
  }
}

// p. much the same thing for the player, except it's up to him/her whether or not to hit.
function playerInitialTurn() {
  dealCards("player", 2, playerLoop);
}

function playerLoop() {
  // var player_hand = game.player_cards.map(function(card) {
  //   return " " + card.value + " of " + card.suit;
  // })
  // alert("Your hand: " + player_hand);
  flipPlayerCards();
  if (game.playertotal === 21) {
    // alert("blackjack! You win!");
    // newGamePrompt();
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash")).append(make$P(" You win!").addClass("win"));
    appendNewGameButton();
  } else if (game.playertotal > 21) {
    // alert("You busted! You lose!");
    // newGamePrompt();
    $MSGAREA.append(make$P("You busted!").removeClass("fadeIn").addClass("swing")).append(make$P(" You lose!").addClass("lose"));
    appendNewGameButton();
  } else {
    appendControlsAndWait();
    //    var choice = confirm("Your total: " + game.playertotal + ". Hit?");
    //    if (choice === true) {
    //      dealCards("player", 1, playerLoop);
    //    } else {
    //      finalReckoning();
    //    }
  }
}
// if the neither the dealer nor the player won outright or busted during their respective turns, we need to compare the totals
// to see who won.
function finalReckoning() {
  // alert("Dealer's total: " + game.dealertotal + "\n\nYour total: " + game.playertotal);
  $MSGAREA.append(make$P("Your total: " + game.playertotal + "&nbsp; &nbsp; Dealer's total: " + game.dealertotal));
  if (game.playertotal > game.dealertotal) {
    // alert("You win!");
    flipDealerCards();
    $MSGAREA.append(make$P("You win!").addClass("win"));
    appendNewGameButton();
  } else if (game.playertotal === game.dealertotal) {
    // alert("OMFG it's a tie!");
    flipDealerCards();
    $MSGAREA.append(make$P("Tie! You lose!").addClass("lose"));
    appendNewGameButton();
  } else {
    // alert("You lose!");
    flipDealerCards();
    $MSGAREA.append(make$P("You lose!").addClass("lose"));
    appendNewGameButton();
  }
}

function newGamePrompt() {
  var choice = confirm("New game?");
  if (choice === true) {
    startGame();
  }
}

function insertPlayerCards(card_arr) {
  card_arr.forEach(function (card_obj) {
    var $card = generateBack$IMG(card_obj);
    //var $card = generateFront$IMG(card_obj);
    $PLAYERHAND.append($card);
  });
}

function generateFront$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS") {
    card_obj.image = "/images/AceOfDiamonds.png";
  }
  var $card = $("<img src='" + card_obj.image + "'>");
  return $card;
}

function generateBack$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS") {
    card_obj.image = "/images/AceOfDiamonds.png";
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

function appendTotal(whom) {
  var total = whom === "player" ? game.playertotal : game.dealertotal;
  var $msg_area = whom === "player" ? $PLAYERMSG : $DEALERMSG;
  var $total = $("<p>Total: " + total + "</p>");
  $msg_area.empty();
  $msg_area.append($total);
}

// append controls and await player decision
function appendControlsAndWait() {
  $PLAYERCONTROLS.empty();
  var $hit = $("<button class='hit-btn'>Hit</button>");
  var $stick = $("<button class='stick-btn'>Stand</button>");
  $PLAYERCONTROLS.append($hit).append($stick);
}

function appendNewGameButton() {
  $PLAYERCONTROLS.empty();
  var $newgame = $("<button class='newgame'>New Game</button>");
  $PLAYERCONTROLS.append($newgame);
}

function flipDealerCards() {
  var img_arr = [].slice.call(document.querySelectorAll(".dealer-hand img"));
  var i = 0;
  var length = img_arr.length;
  function delayedFlip() {
    if (i < length) {
      if (img_arr[i].getAttribute("front_url")) {
        img_arr[i].src = img_arr[i].getAttribute("front_url");
      }
      i += 1;
      setTimeout(function () {
        delayedFlip();
      }, CASCADE_FLIP_TIME);
    }
  }
  delayedFlip();
}

function flipPlayerCards() {
  var img_arr = [].slice.call(document.querySelectorAll(".player-hand img"));
  var i = 0;
  var length = img_arr.length;
  function delayedFlip() {
    if (i < length) {
      img_arr[i].src = img_arr[i].getAttribute("front_url");
    }
    i += 1;
    setTimeout(function () {
      delayedFlip();
    }, CASCADE_FLIP_TIME);
  }
  delayedFlip();
}
//# sourceMappingURL=data:application/json;base64,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QUFBO09BQUMsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDO0tBQzFEO0dBQ0Y7QUFDRCxhQUFXLEVBQUUsQ0FBQztDQUNmOztBQUVELFNBQVMsZUFBZSxHQUFHO0FBQ3pCLE1BQUksT0FBTyxHQUFHLEVBQUUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7QUFDM0UsTUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBQ1YsTUFBSSxNQUFNLEdBQUcsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUM1QixXQUFTLFdBQVcsR0FBRztBQUNyQixRQUFJLENBQUMsR0FBRyxNQUFNLEVBQUU7QUFDWixhQUFPLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7S0FDekQ7QUFDRCxLQUFDLElBQUksQ0FBQyxDQUFDO0FBQ1AsY0FBVSxDQUFDLFlBQVU7QUFBQyxpQkFBVyxFQUFFLENBQUE7S0FBQyxFQUFFLGlCQUFpQixDQUFDLENBQUM7R0FDMUQ7QUFDRCxhQUFXLEVBQUUsQ0FBQztDQUNmIiwiZmlsZSI6InNyYy9qcy9tYWluLmpzIiwic291cmNlc0NvbnRlbnQiOlsidmFyIEFQSV9VUkwgPSBcImh0dHA6Ly9kZWNrb2ZjYXJkc2FwaS5jb20vYXBpXCI7XG52YXIgQVBJX1BST1hZID0gXCJodHRwczovL2pzb25wLmFmZWxkLm1lLz91cmw9XCI7XG52YXIgZ2FtZTtcbnZhciBDQVJEX0JBQ0tfVVJMID0gXCIvaW1hZ2VzL2JhY2sucG5nXCI7XG52YXIgJERFQUxFUkhBTkQgPSAkKCcuZGVhbGVyLWhhbmQnKTtcbnZhciAkUExBWUVSSEFORCA9ICQoJy5wbGF5ZXItaGFuZCcpO1xudmFyICRQTEFZRVJDT05UUk9MUyA9ICQoJy5wbGF5ZXItY29udHJvbHMnKTtcbnZhciAkREVBTEVSTVNHID0gJCgnLmRlYWxlci1tc2cnKTtcbnZhciAkUExBWUVSTVNHID0gJCgnLnBsYXllci1tc2cnKTtcbnZhciAkUExBWUVSV1JBUFBFUiA9ICQoJy5wbGF5ZXItd3JhcHBlcicpO1xudmFyICRNU0dBUkVBID0gJCgnLm1zZy1hcmVhJylcblxuLy8gdGltZSBiZXR3ZWVuIGRlYWxlcidzIGluZGl2aWR1YWwgdHVybnNcbnZhciBERUFMRVJfVFVSTl9ERUxBWSA9IDE1MDA7XG5cbi8vIHRpbWUgYmV0d2VlbiBlYWNoIGluZGl2aWR1YWwgY2FyZCBmbGlwIG9uY2UgZmxpcHBpbmcgaGFzIGJlZ3VuXG52YXIgQ0FTQ0FERV9GTElQX1RJTUUgPSA0MDA7XG5cbiRQTEFZRVJXUkFQUEVSLm9uKCdjbGljaycsICcuaGl0LWJ0bicsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gIGRlYWxDYXJkcyhcInBsYXllclwiLCAxLCBwbGF5ZXJMb29wKTtcbn0pLm9uKCdjbGljaycsICcuc3RpY2stYnRuJywgZnVuY3Rpb24oZXZlbnQpIHtcbiAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgZGVhbGVySW5pdGlhbFR1cm4oKTtcbn0pLm9uKCdjbGljaycsICcubmV3Z2FtZScsIGZ1bmN0aW9uKGV2ZW50KSB7XG4gIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gIHN0YXJ0R2FtZSgpO1xufSlcblxuc3RhcnRHYW1lKCk7XG5cbi8vIHRvIHN0YXJ0IG9mZiB0aGUgZ2FtZSwgbWFrZSBhIG5ldyBnYW1lIG9iamVjdCAod2l0aCBhdHRyaWJ1dGVzIHRoYXQgd2lsbCBwcmVzZXJ2ZSB0aGUgZ2FtZSdzIHN0YXRlLCBpZSwgd2hvIGhhcyB3aGF0IGNhcmRzKSBhbmQgdGhlblxuLy8gYXNrIHRoZSBBUEkgZm9yIGEgZGVjayBJRCB0byBhc3NpZ24gdG8gdGhlIGdhbWUgb2JqZWN0J3MgZGVjayAod2UgbmVlZCB0byB1c2UgaXQgZm9yIHN1YnNlcXVlbnQgY2FsbHMgdG8gdGhlIEFQSSwgd2hlbiB3ZSBhc2sgaXQgZm9yIGNhcmRzIGZyb21cbi8vIG91ciBkZWNrKS5cbi8vIFdlIGNhbid0IGRvIGFueXRoaW5nIHVudGlsIHdlIGhhdmUgdGhhdCBkZWNrIElELCBidXQgdGhlIHByb2dyYW0gd291bGQgaGFwcGlseSBjb250aW51ZSBvbiBwcmlvciB0byBhY3R1YWxseSBsb2FkaW5nIHRoZSBvYmplY3QgdGhhdCBjb250YWlucyB0aGVcbi8vIGRlY2sgSUQuIFNvIHdlIG5lZWQgYSB3YXkgdG8gbWFrZSBpdCB3YWl0IHVudGlsIHRoYXQgb2JqZWN0IGhhcyBzdWNjZXNzZnVsbHkgbG9hZGVkLS0gd2UgZG8gc28gYnkgbWFraW5nIHRoZSBuZXh0IHN0ZXAgaW4gdGhlIHByb2dyYW0sIHdoaWNoXG4vLyBpcyB0aGUgZGVhbGVyJ3MgaW5pdGlhbCB0dXJuLCBmaXJlIGFzIHBhcnQgb2YgdGhlIHNldERlY2tJRCBmdW5jdGlvbidzIGNhbGxiYWNrIGZ1bmN0aW9uLiBUaGF0IHdheSBpdCB3b24ndCBoYXBwZW4gdW50aWwgaXQgaGFzIHRoZSByZXF1aXNpdGUgZGF0YS5cbmZ1bmN0aW9uIHN0YXJ0R2FtZSgpIHtcbiAgZ2FtZSA9IG5ldyBHYW1lKCk7XG4gICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICAkREVBTEVSSEFORC5lbXB0eSgpO1xuICAkUExBWUVSSEFORC5lbXB0eSgpO1xuICAvLyRQTEFZRVJNU0cuZW1wdHkoKTtcbiAgLy8kREVBTEVSTVNHLmVtcHR5KCk7XG4gICRNU0dBUkVBLmVtcHR5KCk7XG4gIHNldERlY2tJZChwbGF5ZXJJbml0aWFsVHVybik7XG59XG5cbi8vIHNldHRpbmcgdXAgYSBnYW1lIG9iamVjdCB0byBwcmVzZXJ2ZSB0aGUgZ2FtZSdzIHN0YXRlLiBUaGlzIGlzIGEgY29uc3RydWN0b3IgZnVuY3Rpb24gdGhhdCBpcyBpbnZva2VkIGFib3ZlIHZpYSBcImdhbWUgPSBuZXcgR2FtZSgpO1wiIHRvXG4vLyBnZW5lcmF0ZSBhIGdhbWUgb2JqZWN0IHdpdGggYWxsIG9mIHRoZSBhdHRyaWJ1dGVzIGxpc3RlZCBiZWxvdy5cbmZ1bmN0aW9uIEdhbWUoKSB7XG4gIHRoaXMuZGVja19pZCA9IFwiXCI7XG4gIHRoaXMuZGVhbGVyX2NhcmRzID0gW107XG4gIHRoaXMucGxheWVyX2NhcmRzID0gW107XG4gIHRoaXMucGxheWVydG90YWwgPSAwO1xuICB0aGlzLmRlYWxlcnRvdGFsID0gMDtcbiAgLy8gdGhpcy5kZWFsZXJGaXJzdFR1cm4gPSB0cnVlO1xufVxuXG4vLyBzZXQgdGhlIHRoZSBnYW1lIG9iamVjdCdzIGRlY2tfaWQgYnkgY2FsbGluZyB0aGUgQVBJIGFuZCBsb29raW5nIGF0IHRoZSBkZWNrX2lkIGF0dHJpYnV0ZSBvZiB0aGUgcmVzcG9uc2UgaXQgZ2l2ZXMgdXMuXG4vLyBBZnRlciB0aGUgZGF0YSBoYXMgbG9hZGVkIChhbmQgd3JpdHRlbiB0byB0aGUgZ2FtZSBvYmplY3QpLCBvdXIgY2FsbGJhY2sgZnVuY3Rpb24gZmlyZXMgb2ZmLCB3aGljaCB3ZSd2ZSBzZXQgdXAgdG8gYmUgd2hhdGV2ZXIgZnVuY3Rpb24gd2UgcGFzcyBpbi5cbi8vIFdlIHBhc3MgaW4gZGVhbGVySW5pdGlhbFR1cm4gKGxpbmUgMTUpIHNvIHRoYXQgdGhlIGdhbWUgc3RhcnRzLlxuICBcbmZ1bmN0aW9uIHNldERlY2tJZChjYWxsYmFjaykge1xuICAkLmdldChBUElfUFJPWFkgKyBBUElfVVJMICsgXCIvc2h1ZmZsZS8/ZGVja19jb3VudD02XCIsIGZ1bmN0aW9uKG9iail7XG4gICAgZ2FtZS5kZWNrX2lkID0gb2JqLmRlY2tfaWQ7XG4gICAgY2FsbGJhY2soKTtcbiAgfSwgJ2pzb24nKTtcbn1cblxuLy8gc3BlY2lmeSBcInBsYXllclwiIG9yIFwiZGVhbGVyXCIgYW5kIGhvdyBtYW55IGNhcmRzLiBUaGVpciBhcnJheSB3aWxsIGJlIHBvcHVsYXRlZCB3aXRoIHRoZSBjYXJkcyAodmlhIGFycmF5IGNvbmNhdGVuYXRpb24pIFxuLy8gYW5kIHRoZSB0b3RhbCB1cGRhdGVkICh3aWxsIG1ha2UgQWNlcyB3b3J0aFxuLy8gMSBpbnN0ZWFkIG9mIDExIGlmIGl0IHdpbGwgcHJldmVudCBidXN0aW5nOyBzZWUgc3Vic2VxdWVudCBmdW5jdGlvbnMgZm9yIGRldGFpbHMgb24gaG93IHRoaXMgaGFwcGVucy5cbi8vIGh0dHA6Ly9kZWNrb2ZjYXJkc2FwaS5jb20vIHNob3dzIHdoYXQgdGhlIHJlc3BvbnNlIG9iamVjdCBsb29rcyBsaWtlOyBjaGVjayB1bmRlciBcImRyYXcgYSBjYXJkXCIuXG5mdW5jdGlvbiBkZWFsQ2FyZHModG93aG9tLCBudW0sIGNhbGxiYWNrKSB7XG4gIHZhciBnZXRfdXJsID0gQVBJX1BST1hZICsgQVBJX1VSTCArIFwiL2RyYXcvXCIgKyBnYW1lLmRlY2tfaWQgKyBcIi8/Y291bnQ9XCIgKyBudW07XG4gICQuZ2V0KGdldF91cmwsIGZ1bmN0aW9uKG9iail7XG4gICAgaWYgKHRvd2hvbS50b0xvd2VyQ2FzZSgpID09PSBcInBsYXllclwiKSB7XG4gICAgICBnYW1lLnBsYXllcl9jYXJkcyA9IGdhbWUucGxheWVyX2NhcmRzLmNvbmNhdChvYmouY2FyZHMpO1xuICAgICAgaW5zZXJ0UGxheWVyQ2FyZHMob2JqLmNhcmRzKTtcbiAgICAgIHVwZGF0ZVRvdGFsKFwicGxheWVyXCIpO1xuICAgICAgLy9hcHBlbmRUb3RhbChcInBsYXllclwiKTtcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBnYW1lLmRlYWxlcl9jYXJkcyA9IGdhbWUuZGVhbGVyX2NhcmRzLmNvbmNhdChvYmouY2FyZHMpO1xuICAgICAgaW5zZXJ0RGVhbGVyQ2FyZHMob2JqLmNhcmRzKTtcbiAgICAgIHVwZGF0ZVRvdGFsKFwiZGVhbGVyXCIpO1xuICAgICAgLy9hcHBlbmRUb3RhbChcImRlYWxlclwiKTtcbiAgICB9XG4gICAgY2FsbGJhY2soKTtcbiAgfSwgJ2pzb24nKTtcbn1cblxuLy8gZW50ZXIgXCJwbGF5ZXJcIiBvciBcImRlYWxlclwiLiBJdCB3aWxsIHN1bSB1cCB0aGUgdG90YWwgb2YgdGhlIGNhcmRzLFxuLy8gd2l0aCBhY2VzIG1vdmVkIHRvIHRoZSBiYWNrIHNvIHRoYXQgdGhlIGNvbXB1dGVyIGNhbiBkZWNpZGUgdG8gY291bnQgdGhlbSBhc1xuLy8gMSBpZiBpdCB3aWxsIHByZXZlbnQgYnVzdGluZy4gVGhlIG5ldyB0b3RhbCBpcyB3cml0dGVuIHRvIHRoZSBnYW1lIG9iamVjdC4gVGhpcyBkb2Vzbid0IG1vZGlmeSB0aGUgb3JpZ2luYWxcbi8vIGNhcmQgb3JkZXI7IGRvbid0IHdhbnQgdG8gZG8gdGhhdCwgYmVjYXVzZSB3ZSB3YW50IHRvIGtlZXAgdGhlIG9yZGVyIGZvciBkaXNwbGF5IHB1cnBvc2VzLlxuLy8gc28gZG9pbmcgLnNsaWNlKCkgb24gdGhlIGNhcmQgYXJyYXlzIHdpbGwgbGV0IHVzIG1ha2UgdGhlIGFjZXNUb0JhY2stZWQgYXJyYXlzIGZyb20gY29waWVzLlxuZnVuY3Rpb24gdXBkYXRlVG90YWwod2hvbSkge1xuICB2YXIgY2FyZHMgPSB3aG9tLnRvTG93ZXJDYXNlKCkgPT09IFwicGxheWVyXCIgPyBnYW1lLnBsYXllcl9jYXJkcy5zbGljZSgpIDogZ2FtZS5kZWFsZXJfY2FyZHMuc2xpY2UoKTtcbiAgdmFyIHRvdGFsID1cbiAgYWNlc1RvQmFjayhjYXJkcykucmVkdWNlKGZ1bmN0aW9uKGFjYywgY2FyZCkge1xuICAgIGlmIChjYXJkLnZhbHVlID09PSBcIktJTkdcIiB8fCBjYXJkLnZhbHVlID09PSBcIlFVRUVOXCIgfHwgY2FyZC52YWx1ZSA9PT0gXCJKQUNLXCIpIHtcbiAgICAgIHJldHVybiBhY2MgKyAxMDtcbiAgICB9XG4gICAgZWxzZSBpZiAoY2FyZC52YWx1ZSA9PT0gXCJBQ0VcIikge1xuICAgICAgaWYgKGFjYyArIDExIDwgMjIpIHtyZXR1cm4gYWNjICsgMTF9XG4gICAgICBlbHNlIHtyZXR1cm4gYWNjICsgMX1cbiAgICB9XG4gICAgZWxzZSB7cmV0dXJuIGFjYyArIHBhcnNlSW50KGNhcmQudmFsdWUpfVxuICB9LCAwKVxuICB3aG9tLnRvTG93ZXJDYXNlKCkgPT09IFwicGxheWVyXCIgPyAoZ2FtZS5wbGF5ZXJ0b3RhbCA9IHRvdGFsKSA6IChnYW1lLmRlYWxlcnRvdGFsID0gdG90YWwpO1xufVxuXG4vLyBhY2VzIHRvIGJhY2sgb2YgYXJyYXkgZm9yIHN1bW1hdGlvbiBwdXJwb3Nlcy5cbi8vIExvb2sgYXQgYWxsIGNhcmRzOyBhY2U/IElmIHNvIG1vdmUgaXQgdG8gdGhlIGJhY2suIE5vdCBhY2U/IE1vdmUgaXQgdG8gdGhlIGZyb250LlxuZnVuY3Rpb24gYWNlc1RvQmFjayhhcnIpIHtcbiAgdmFyIHJldHVybl9hcnIgPSBbXTtcbiAgYXJyLmZvckVhY2goZnVuY3Rpb24oY2FyZCkge1xuICAgIGlmIChjYXJkLnZhbHVlID09PSBcIkFDRVwiKSB7cmV0dXJuX2Fyci5wdXNoKGNhcmQpfVxuICAgIGVsc2Uge3JldHVybl9hcnIudW5zaGlmdChjYXJkKX1cbiAgfSlcbiAgcmV0dXJuIHJldHVybl9hcnI7XG59XG5cbi8vIEZpcnN0IHR1cm4uIERlYWwgMiBjYXJkcyB0byB0aGUgZGVhbGVyLCBhbmQgYWZ0ZXIgdGhlIGRhdGEgaXMgbG9hZGVkLCBpbnZva2UgZGVhbGVyTG9vcCBhcyB0aGUgY2FsbGJhY2sgZnVuY3Rpb24uXG5mdW5jdGlvbiBkZWFsZXJJbml0aWFsVHVybigpIHtcbiAgZGVhbENhcmRzKFwiZGVhbGVyXCIsIDIsIGRlYWxlckxvb3ApO1xufVxuXG4vLyBUZWxsIHBsYXllciB3aGF0IHRoZSBkZWFsZXIncyBmaXJzdCBjYXJkIGlzIChvbmx5IG9uIHRoZSBmaXJzdCB0aW1lLCBvdGhlcndpc2UgaXQncyBhbm5veWluZykuXG4vLyBIYXZlIHRoZSBkZWFsZXIga2VlcCBoaXR0aW5nIChieSBjYWxsaW5nIHRoaXMgZnVuY3Rpb24gYWdhaW4pIHVudGlsIGhlIHJlYWNoZXMgMTcgb3IgbW9yZTsgb25jZSBoZSBkb2VzLFxuLy8gc2VlIHdoZXJlIGhlL3NoZSBzdGFuZHMuXG5mdW5jdGlvbiBkZWFsZXJMb29wKCkge1xuICAvLyBpZiAoZ2FtZS5kZWFsZXJGaXJzdFR1cm4pe1xuICAgIC8vIGFsZXJ0KFwiRGVhbGVyJ3MgZmlyc3QgY2FyZCA6IFwiICsgZ2FtZS5kZWFsZXJfY2FyZHNbMF0udmFsdWUgKyBcIiBvZiBcIiArIGdhbWUuZGVhbGVyX2NhcmRzWzBdLnN1aXQpO1xuICAgIC8vIGdhbWUuZGVhbGVyRmlyc3RUdXJuID0gZmFsc2U7XG4gIC8vIH1cbiAgaWYgKGdhbWUuZGVhbGVydG90YWwgPCAxNykge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7ZGVhbENhcmRzKFwiZGVhbGVyXCIsIDEsIGRlYWxlckxvb3ApfSwgREVBTEVSX1RVUk5fREVMQVkpO1xuICB9IGVsc2Uge1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKSB7ZGVhbGVyVHVyblJlc3VsdCgpfSwgREVBTEVSX1RVUk5fREVMQVkpO1xuICB9XG59XG5cbi8vIHR1cm4gdGhlIGNhcmQgYXJyYXkgaW50byBzb21ldGhpbmcgd2UgY2FuIGRpc3BsYXkgKGJ5IGR1cmluZyBlYWNoIGNhcmQgb2JqZWN0IGludG8gYSBzdHJpbmcgaW5jbHVkaW5nIGl0cyB2YWx1ZSBhbmQgc3VpdCkuXG4vLyBUaGVuIGRpc3BsYXkgdGhlIGFwcHJvcHJpYXRlIG1lc3NhZ2UuXG5mdW5jdGlvbiBtYWtlJFAoc3RyaW5nKSB7XG4gIHJldHVybiAoJChcIjxwPlwiICsgc3RyaW5nICsgXCI8L3A+XCIpLmFkZENsYXNzKFwiYW5pbWF0ZWQgZmFkZUluXCIpKTtcbn1cblxuZnVuY3Rpb24gZGVhbGVyVHVyblJlc3VsdCgpIHtcbiAgdmFyIGRlYWxlcl9oYW5kID0gZ2FtZS5kZWFsZXJfY2FyZHMubWFwKGZ1bmN0aW9uKGNhcmQpIHtcbiAgICByZXR1cm4gXCIgXCIgKyBjYXJkLnZhbHVlICsgXCIgb2YgXCIgKyBjYXJkLnN1aXQ7XG4gIH0pXG4gIGlmIChnYW1lLmRlYWxlcnRvdGFsID09PSAyMSkge1xuICAgIC8vIGFsZXJ0KFwiRGVhbGVyJ3MgaGFuZDogXCIgKyBkZWFsZXJfaGFuZCArIFwiXFxuXFxuQmxhY2tqYWNrISBEZWFsZXIgd2lucyFcIik7XG4gICAgZmxpcERlYWxlckNhcmRzKClcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiQmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKS5hcHBlbmQobWFrZSRQKFwiIERlYWxlciB3aW5zIVwiKS5hZGRDbGFzcyhcImxvc2VcIikpXG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICAgIC8vIG5ld0dhbWVQcm9tcHQoKTtcbiAgfVxuICBlbHNlIGlmIChnYW1lLmRlYWxlcnRvdGFsID4gMjEpIHtcbiAgICAvLyBhbGVydChcIkRlYWxlcidzIGhhbmQ6IFwiICsgZGVhbGVyX2hhbmQgKyBcIlxcblxcbkRlYWxlciBidXN0cyEgU28geW91IHdpbiFcIik7XG4gICAgZmxpcERlYWxlckNhcmRzKClcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiRGVhbGVyIGJ1c3RzIVwiKSkuYXBwZW5kKG1ha2UkUChcIiBZb3Ugd2luIVwiKS5hZGRDbGFzcyhcIndpblwiKSlcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gICAgLy8gLS0tPiBmbGlwIHRoZSBkZWFsZXIncyBjYXJkcyBvdmVyIG5vdyA8LS0tXG4gICAgLy8gbmV3R2FtZVByb21wdCgpO1xuICB9IGVsc2Uge1xuICAgIC8vIGFsZXJ0KFwicGxheWVyJ3MgdHVyblwiKVxuICAgIGZpbmFsUmVja29uaW5nKCk7XG4gIH1cbn1cblxuLy8gcC4gbXVjaCB0aGUgc2FtZSB0aGluZyBmb3IgdGhlIHBsYXllciwgZXhjZXB0IGl0J3MgdXAgdG8gaGltL2hlciB3aGV0aGVyIG9yIG5vdCB0byBoaXQuXG5mdW5jdGlvbiBwbGF5ZXJJbml0aWFsVHVybigpIHtcbiAgZGVhbENhcmRzKFwicGxheWVyXCIsIDIsIHBsYXllckxvb3ApO1xufVxuXG5mdW5jdGlvbiBwbGF5ZXJMb29wKCkge1xuICAvLyB2YXIgcGxheWVyX2hhbmQgPSBnYW1lLnBsYXllcl9jYXJkcy5tYXAoZnVuY3Rpb24oY2FyZCkge1xuICAvLyAgIHJldHVybiBcIiBcIiArIGNhcmQudmFsdWUgKyBcIiBvZiBcIiArIGNhcmQuc3VpdDtcbiAgLy8gfSlcbiAgLy8gYWxlcnQoXCJZb3VyIGhhbmQ6IFwiICsgcGxheWVyX2hhbmQpO1xuICBmbGlwUGxheWVyQ2FyZHMoKTtcbiAgaWYgKGdhbWUucGxheWVydG90YWwgPT09IDIxKSB7XG4gICAgLy8gYWxlcnQoXCJibGFja2phY2shIFlvdSB3aW4hXCIpO1xuICAgIC8vIG5ld0dhbWVQcm9tcHQoKTtcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiQmxhY2tqYWNrIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcImZsYXNoXCIpKS5hcHBlbmQobWFrZSRQKFwiIFlvdSB3aW4hXCIpLmFkZENsYXNzKFwid2luXCIpKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH0gZWxzZSBpZiAoZ2FtZS5wbGF5ZXJ0b3RhbCA+IDIxKSB7XG4gICAgLy8gYWxlcnQoXCJZb3UgYnVzdGVkISBZb3UgbG9zZSFcIik7XG4gICAgLy8gbmV3R2FtZVByb21wdCgpO1xuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJZb3UgYnVzdGVkIVwiKS5yZW1vdmVDbGFzcyhcImZhZGVJblwiKS5hZGRDbGFzcyhcInN3aW5nXCIpKS5hcHBlbmQobWFrZSRQKFwiIFlvdSBsb3NlIVwiKS5hZGRDbGFzcyhcImxvc2VcIikpO1xuICAgIGFwcGVuZE5ld0dhbWVCdXR0b24oKTtcbiAgfSBlbHNlIHtcbiAgICAgIGFwcGVuZENvbnRyb2xzQW5kV2FpdCgpO1xuLy8gICAgdmFyIGNob2ljZSA9IGNvbmZpcm0oXCJZb3VyIHRvdGFsOiBcIiArIGdhbWUucGxheWVydG90YWwgKyBcIi4gSGl0P1wiKTtcbi8vICAgIGlmIChjaG9pY2UgPT09IHRydWUpIHtcbi8vICAgICAgZGVhbENhcmRzKFwicGxheWVyXCIsIDEsIHBsYXllckxvb3ApO1xuLy8gICAgfSBlbHNlIHtcbi8vICAgICAgZmluYWxSZWNrb25pbmcoKTtcbi8vICAgIH1cbiAgfVxufVxuLy8gaWYgdGhlIG5laXRoZXIgdGhlIGRlYWxlciBub3IgdGhlIHBsYXllciB3b24gb3V0cmlnaHQgb3IgYnVzdGVkIGR1cmluZyB0aGVpciByZXNwZWN0aXZlIHR1cm5zLCB3ZSBuZWVkIHRvIGNvbXBhcmUgdGhlIHRvdGFsc1xuLy8gdG8gc2VlIHdobyB3b24uXG5mdW5jdGlvbiBmaW5hbFJlY2tvbmluZygpIHtcbiAgLy8gYWxlcnQoXCJEZWFsZXIncyB0b3RhbDogXCIgKyBnYW1lLmRlYWxlcnRvdGFsICsgXCJcXG5cXG5Zb3VyIHRvdGFsOiBcIiArIGdhbWUucGxheWVydG90YWwpO1xuICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiWW91ciB0b3RhbDogXCIgKyBnYW1lLnBsYXllcnRvdGFsICsgXCImbmJzcDsgJm5ic3A7IERlYWxlcidzIHRvdGFsOiBcIiArIGdhbWUuZGVhbGVydG90YWwpKTtcbiAgaWYgKGdhbWUucGxheWVydG90YWwgPiBnYW1lLmRlYWxlcnRvdGFsKSB7XG4gICAgLy8gYWxlcnQoXCJZb3Ugd2luIVwiKTtcbiAgICBmbGlwRGVhbGVyQ2FyZHMoKVxuICAgICRNU0dBUkVBLmFwcGVuZChtYWtlJFAoXCJZb3Ugd2luIVwiKS5hZGRDbGFzcyhcIndpblwiKSk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9IGVsc2UgaWYgKGdhbWUucGxheWVydG90YWwgPT09IGdhbWUuZGVhbGVydG90YWwpIHtcbiAgICAvLyBhbGVydChcIk9NRkcgaXQncyBhIHRpZSFcIik7XG4gICAgZmxpcERlYWxlckNhcmRzKClcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiVGllISBZb3UgbG9zZSFcIikuYWRkQ2xhc3MoXCJsb3NlXCIpKTtcbiAgICBhcHBlbmROZXdHYW1lQnV0dG9uKCk7XG4gIH0gZWxzZSB7XG4gICAgLy8gYWxlcnQoXCJZb3UgbG9zZSFcIik7XG4gICAgZmxpcERlYWxlckNhcmRzKClcbiAgICAkTVNHQVJFQS5hcHBlbmQobWFrZSRQKFwiWW91IGxvc2UhXCIpLmFkZENsYXNzKFwibG9zZVwiKSk7XG4gICAgYXBwZW5kTmV3R2FtZUJ1dHRvbigpO1xuICB9XG59XG5cbmZ1bmN0aW9uIG5ld0dhbWVQcm9tcHQoKSB7XG4gIHZhciBjaG9pY2UgPSBjb25maXJtKFwiTmV3IGdhbWU/XCIpO1xuICBpZiAoY2hvaWNlID09PSB0cnVlKSB7XG4gICAgc3RhcnRHYW1lKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gaW5zZXJ0UGxheWVyQ2FyZHMoY2FyZF9hcnIpIHtcbiAgY2FyZF9hcnIuZm9yRWFjaChmdW5jdGlvbihjYXJkX29iaikge1xuICAgIHZhciAkY2FyZCA9IGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopO1xuICAgIC8vdmFyICRjYXJkID0gZ2VuZXJhdGVGcm9udCRJTUcoY2FyZF9vYmopO1xuICAgICRQTEFZRVJIQU5ELmFwcGVuZCgkY2FyZCk7XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGdlbmVyYXRlRnJvbnQkSU1HKGNhcmRfb2JqKSB7XG4gIGlmIChjYXJkX29iai52YWx1ZSA9PT0gXCJBQ0VcIiAmJiBjYXJkX29iai5zdWl0ID09PSBcIkRJQU1PTkRTXCIpe1xuICAgIGNhcmRfb2JqLmltYWdlID0gXCIvaW1hZ2VzL0FjZU9mRGlhbW9uZHMucG5nXCI7XG4gIH1cbiAgdmFyICRjYXJkID0gJChcIjxpbWcgc3JjPSdcIiArIGNhcmRfb2JqLmltYWdlICsgXCInPlwiKTtcbiAgcmV0dXJuICRjYXJkO1xufVxuXG5mdW5jdGlvbiBnZW5lcmF0ZUJhY2skSU1HKGNhcmRfb2JqKSB7XG4gIGlmIChjYXJkX29iai52YWx1ZSA9PT0gXCJBQ0VcIiAmJiBjYXJkX29iai5zdWl0ID09PSBcIkRJQU1PTkRTXCIpe1xuICAgIGNhcmRfb2JqLmltYWdlID0gXCIvaW1hZ2VzL0FjZU9mRGlhbW9uZHMucG5nXCI7XG4gIH1cbiAgdmFyICRjYXJkID0gJChcIjxpbWcgc3JjPSdcIiArIENBUkRfQkFDS19VUkwgKyBcIicgZnJvbnRfdXJsID0gJ1wiICsgY2FyZF9vYmouaW1hZ2UgKyBcIic+XCIpO1xuICByZXR1cm4gJGNhcmQ7XG59XG5cbmZ1bmN0aW9uIGluc2VydERlYWxlckNhcmRzKGNhcmRfYXJyKSB7XG4gIGNhcmRfYXJyLmZvckVhY2goZnVuY3Rpb24oY2FyZF9vYmosIGkpIHtcbiAgICBpZiAoJERFQUxFUkhBTkQuaXMoJzplbXB0eScpICYmIGkgPT09IDApIHtcbiAgICAgIHZhciAkY2FyZCA9IGdlbmVyYXRlRnJvbnQkSU1HKGNhcmRfb2JqKTtcbiAgICAgICRERUFMRVJIQU5ELmFwcGVuZCgkY2FyZCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHZhciAkY2FyZCA9IGdlbmVyYXRlQmFjayRJTUcoY2FyZF9vYmopO1xuICAgICAgJERFQUxFUkhBTkQuYXBwZW5kKCRjYXJkKTtcbiAgICB9XG4gIH0pXG59XG5cbmZ1bmN0aW9uIGFwcGVuZFRvdGFsKHdob20pIHtcbiAgdmFyIHRvdGFsID0gd2hvbSA9PT0gXCJwbGF5ZXJcIiA/XG4gICAgZ2FtZS5wbGF5ZXJ0b3RhbDpcbiAgICBnYW1lLmRlYWxlcnRvdGFsO1xuICB2YXIgJG1zZ19hcmVhID0gd2hvbSA9PT0gXCJwbGF5ZXJcIiA/XG4gICAgJFBMQVlFUk1TRzpcbiAgICAkREVBTEVSTVNHO1xuICB2YXIgJHRvdGFsID0gJChcIjxwPlRvdGFsOiBcIiArIHRvdGFsICsgXCI8L3A+XCIpO1xuICAkbXNnX2FyZWEuZW1wdHkoKTtcbiAgJG1zZ19hcmVhLmFwcGVuZCgkdG90YWwpO1xufVxuXG4vLyBhcHBlbmQgY29udHJvbHMgYW5kIGF3YWl0IHBsYXllciBkZWNpc2lvblxuZnVuY3Rpb24gYXBwZW5kQ29udHJvbHNBbmRXYWl0KCkge1xuICAkUExBWUVSQ09OVFJPTFMuZW1wdHkoKTtcbiAgdmFyICRoaXQgPSAkKFwiPGJ1dHRvbiBjbGFzcz0naGl0LWJ0bic+SGl0PC9idXR0b24+XCIpO1xuICB2YXIgJHN0aWNrID0gJChcIjxidXR0b24gY2xhc3M9J3N0aWNrLWJ0bic+U3RhbmQ8L2J1dHRvbj5cIik7XG4gICRQTEFZRVJDT05UUk9MUy5hcHBlbmQoJGhpdCkuYXBwZW5kKCRzdGljayk7XG59XG5cbmZ1bmN0aW9uIGFwcGVuZE5ld0dhbWVCdXR0b24oKSB7XG4gICRQTEFZRVJDT05UUk9MUy5lbXB0eSgpO1xuICB2YXIgJG5ld2dhbWUgPSAkKFwiPGJ1dHRvbiBjbGFzcz0nbmV3Z2FtZSc+TmV3IEdhbWU8L2J1dHRvbj5cIik7XG4gICRQTEFZRVJDT05UUk9MUy5hcHBlbmQoJG5ld2dhbWUpO1xufVxuXG5mdW5jdGlvbiBmbGlwRGVhbGVyQ2FyZHMoKSB7XG4gIHZhciBpbWdfYXJyID0gW10uc2xpY2UuY2FsbChkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsKFwiLmRlYWxlci1oYW5kIGltZ1wiKSk7XG4gIHZhciBpID0gMDtcbiAgdmFyIGxlbmd0aCA9IGltZ19hcnIubGVuZ3RoO1xuICBmdW5jdGlvbiBkZWxheWVkRmxpcCgpIHtcbiAgICBpZiAoaSA8IGxlbmd0aCkge1xuICAgICAgaWYgKGltZ19hcnJbaV0uZ2V0QXR0cmlidXRlKFwiZnJvbnRfdXJsXCIpKSB7XG4gICAgICAgIGltZ19hcnJbaV0uc3JjID0gaW1nX2FycltpXS5nZXRBdHRyaWJ1dGUoXCJmcm9udF91cmxcIik7XG4gICAgICB9XG4gICAgICBpICs9IDE7XG4gICAgICBzZXRUaW1lb3V0KGZ1bmN0aW9uKCl7ZGVsYXllZEZsaXAoKX0sIENBU0NBREVfRkxJUF9USU1FKTtcbiAgICB9XG4gIH1cbiAgZGVsYXllZEZsaXAoKTtcbn1cblxuZnVuY3Rpb24gZmxpcFBsYXllckNhcmRzKCkge1xuICB2YXIgaW1nX2FyciA9IFtdLnNsaWNlLmNhbGwoZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbChcIi5wbGF5ZXItaGFuZCBpbWdcIikpO1xuICB2YXIgaSA9IDA7XG4gIHZhciBsZW5ndGggPSBpbWdfYXJyLmxlbmd0aDtcbiAgZnVuY3Rpb24gZGVsYXllZEZsaXAoKSB7XG4gICAgaWYgKGkgPCBsZW5ndGgpIHtcbiAgICAgICAgaW1nX2FycltpXS5zcmMgPSBpbWdfYXJyW2ldLmdldEF0dHJpYnV0ZShcImZyb250X3VybFwiKTtcbiAgICB9XG4gICAgaSArPSAxO1xuICAgIHNldFRpbWVvdXQoZnVuY3Rpb24oKXtkZWxheWVkRmxpcCgpfSwgQ0FTQ0FERV9GTElQX1RJTUUpO1xuICB9XG4gIGRlbGF5ZWRGbGlwKCk7XG59XG4iXX0=