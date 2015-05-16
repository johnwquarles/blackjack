var API_URL = "http://deckofcardsapi.com/api";
var API_PROXY = "https://jsonp.afeld.me/?url=";
var game;
var CARD_BACK_URL = "/images/back.png";
var $DEALERHAND = $('.dealer-hand');
var $PLAYERHAND = $('.player-hand');
var $PLAYERCONTROLS = $('.player-controls');
var $DEALERMSG = $('.dealer-msg');
var $PLAYERMSG = $('.player-msg');
var $PLAYERWRAPPER = $('.player-wrapper');
var $MSGAREA = $('.msg-area')

// time between dealer's individual turns
var DEALER_TURN_DELAY = 1500;

// time between each individual card flip once flipping has begun
var CASCADE_FLIP_TIME = 400;

$PLAYERWRAPPER.on('click', '.hit-btn', function(event) {
  event.preventDefault();
  dealCards("player", 1, playerLoop);
}).on('click', '.stick-btn', function(event) {
  event.preventDefault();
  dealerInitialTurn();
}).on('click', '.newgame', function(event) {
  event.preventDefault();
  startGame();
})

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
  $.get(API_PROXY + API_URL + "/shuffle/?deck_count=6", function(obj){
    game.deck_id = obj.deck_id;
    callback();
  }, 'json');
}

// specify "player" or "dealer" and how many cards. Their array will be populated with the cards (via array concatenation) 
// and the total updated (will make Aces worth
// 1 instead of 11 if it will prevent busting; see subsequent functions for details on how this happens.
// http://deckofcardsapi.com/ shows what the response object looks like; check under "draw a card".
function dealCards(towhom, num, callback) {
  var get_url = API_PROXY + API_URL + "/draw/" + game.deck_id + "/?count=" + num;
  $.get(get_url, function(obj){
    if (towhom.toLowerCase() === "player") {
      game.player_cards = game.player_cards.concat(obj.cards);
      insertPlayerCards(obj.cards);
      updateTotal("player");
      //appendTotal("player");
    }
    else {
      game.dealer_cards = game.dealer_cards.concat(obj.cards);
      insertDealerCards(obj.cards);
      updateTotal("dealer");
      //appendTotal("dealer");
    }
    callback();
  }, 'json');
}

// enter "player" or "dealer". It will sum up the total of the cards,
// with aces moved to the back so that the computer can decide to count them as
// 1 if it will prevent busting. The new total is written to the game object. This doesn't modify the original
// card order; don't want to do that, because we want to keep the order for display purposes.
// so doing .slice() on the card arrays will let us make the acesToBack-ed arrays from copies.
function updateTotal(whom) {
  var cards = whom.toLowerCase() === "player" ? game.player_cards.slice() : game.dealer_cards.slice();
  var total =
  acesToBack(cards).reduce(function(acc, card) {
    if (card.value === "KING" || card.value === "QUEEN" || card.value === "JACK") {
      return acc + 10;
    }
    else if (card.value === "ACE") {
      if (acc + 11 < 22) {return acc + 11}
      else {return acc + 1}
    }
    else {return acc + parseInt(card.value)}
  }, 0)
  whom.toLowerCase() === "player" ? (game.playertotal = total) : (game.dealertotal = total);
}

// aces to back of array for summation purposes.
// Look at all cards; ace? If so move it to the back. Not ace? Move it to the front.
function acesToBack(arr) {
  var return_arr = [];
  arr.forEach(function(card) {
    if (card.value === "ACE") {return_arr.push(card)}
    else {return_arr.unshift(card)}
  })
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
    setTimeout(function() {dealCards("dealer", 1, dealerLoop)}, DEALER_TURN_DELAY);
  } else {
    setTimeout(function() {dealerTurnResult()}, DEALER_TURN_DELAY);
  }
}

// turn the card array into something we can display (by during each card object into a string including its value and suit).
// Then display the appropriate message.
function make$P(string) {
  return ($("<p>" + string + "</p>").addClass("animated fadeIn"));
}

function dealerTurnResult() {
  var dealer_hand = game.dealer_cards.map(function(card) {
    return " " + card.value + " of " + card.suit;
  })
  if (game.dealertotal === 21) {
    // alert("Dealer's hand: " + dealer_hand + "\n\nBlackjack! Dealer wins!");
    flipDealerCards()
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash")).append(make$P(" Dealer wins!").addClass("lose"))
    appendNewGameButton();
    // newGamePrompt();
  }
  else if (game.dealertotal > 21) {
    // alert("Dealer's hand: " + dealer_hand + "\n\nDealer busts! So you win!");
    flipDealerCards()
    $MSGAREA.append(make$P("Dealer busts!")).append(make$P(" You win!").addClass("win"))
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
    flipDealerCards()
    $MSGAREA.append(make$P("You win!").addClass("win"));
    appendNewGameButton();
  } else if (game.playertotal === game.dealertotal) {
    // alert("OMFG it's a tie!");
    flipDealerCards()
    $MSGAREA.append(make$P("Tie! You lose!").addClass("lose"));
    appendNewGameButton();
  } else {
    // alert("You lose!");
    flipDealerCards()
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
  card_arr.forEach(function(card_obj) {
    var $card = generateBack$IMG(card_obj);
    //var $card = generateFront$IMG(card_obj);
    $PLAYERHAND.append($card);
  })
}

function generateFront$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS"){
    card_obj.image = "/images/AceOfDiamonds.png";
  }
  var $card = $("<img src='" + card_obj.image + "'>");
  return $card;
}

function generateBack$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS"){
    card_obj.image = "/images/AceOfDiamonds.png";
  }
  var $card = $("<img src='" + CARD_BACK_URL + "' front_url = '" + card_obj.image + "'>");
  return $card;
}

function insertDealerCards(card_arr) {
  card_arr.forEach(function(card_obj, i) {
    if ($DEALERHAND.is(':empty') && i === 0) {
      var $card = generateFront$IMG(card_obj);
      $DEALERHAND.append($card);
    } else {
      var $card = generateBack$IMG(card_obj);
      $DEALERHAND.append($card);
    }
  })
}

function appendTotal(whom) {
  var total = whom === "player" ?
    game.playertotal:
    game.dealertotal;
  var $msg_area = whom === "player" ?
    $PLAYERMSG:
    $DEALERMSG;
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
      setTimeout(function(){delayedFlip()}, CASCADE_FLIP_TIME);
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
    setTimeout(function(){delayedFlip()}, CASCADE_FLIP_TIME);
  }
  delayedFlip();
}
