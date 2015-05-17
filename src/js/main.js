var API_URL = "http://deckofcardsapi.com/api";
var API_PROXY = "https://jsonp.afeld.me/?url=";
var game;
var CARD_BACK_URL = "images/back.png";
var $DEALERHAND = $('.dealer-hand');
var $PLAYERHAND = $('.player-hand');
var $PLAYERCONTROLS = $('.player-controls');
var $DEALERMSG = $('.dealer-msg');
var $PLAYERMSG = $('.player-msg');
var $PLAYERWRAPPER = $('.player-wrapper');
var $MSGAREA = $('.msg-area')
var cardflip_events = [];
var MSG_STAGGER = 600;

// time between dealer's card flips upon a game over.
var DEALER_CASCADE_FLIP_TIME = 180;

// time between dealer's individual turns
var DEALER_TURN_DELAY = 1500;

// time between each individual card flip once flipping has begun
var CASCADE_FLIP_TIME = 400;

$PLAYERWRAPPER.on('click', '.hit-btn', function(event) {
  event.preventDefault();
  dealCards("player", 1, playerLoop);
}).on('click', '.stick-btn', function(event) {
  event.preventDefault();
  $PLAYERCONTROLS.empty();
  dealerInitialTurn();
}).on('click', '.newgame', function(event) {
  event.preventDefault();
  $PLAYERCONTROLS.empty();
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
    }
    else {
      game.dealer_cards = game.dealer_cards.concat(obj.cards);
      insertDealerCards(obj.cards);
      updateTotal("dealer");
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
    setTimeout(function() {dealCards("dealer", 1, dealerLoop)}, DEALER_TURN_DELAY);
  } else {
    setTimeout(function() {dealerTurnResult()}, DEALER_TURN_DELAY);
  }
}

function make$P(string) {
  return ($("<p>" + string + "</p>").addClass("animated fadeIn"));
}

function dealerTurnResult() {
  if (game.dealertotal === 21 && game.dealer_cards.length === 2 && game.playerblackjack === false) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash"));
    setTimeout(function(){
      $MSGAREA.append(make$P(" Dealer wins!").addClass("lose"))
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  }
  else if (game.dealertotal === 21 && game.dealer_cards.length === 2 && game.playerblackjack === true) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Double-blackjack!").removeClass("fadeIn").addClass("flash"));
    setTimeout(function(){
      $MSGAREA.append(make$P("Push!"));
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  }
  else if (game.playerblackjack === true) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Blackjack!").removeClass("fadeIn").addClass("flash"));
    setTimeout(function(){
      $MSGAREA.append(make$P(" You win!").addClass("win"));
    }, MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  }
  else if (game.dealertotal > 21) {
    //flipDealerCards();
    $MSGAREA.append(make$P("Dealer busts!"))
    setTimeout(function() {
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
  setTimeout(function(){
    $MSGAREA.append(make$P(" You lose!").addClass("lose"));
  }, MSG_STAGGER);
  appendNewGameButton();
}

// if the neither the dealer nor the player won outright or busted during their respective turns, we need to compare the totals
// to see who won.
function finalReckoning() {
  $MSGAREA.append(make$P("Your total: " + game.playertotal).addClass("nomargin"));
  
  setTimeout(function(){$MSGAREA.append(make$P("Dealer's total: " + game.dealertotal).addClass("nomargin"))}, MSG_STAGGER);
  //$MSGAREA.append(make$P("&nbsp; &nbsp; Dealer's total: " + game.dealertotal).addClass("inline").addClass("hidden"));
  //setTimeout(function(){$(".msg-area p:last-child").removeClass("hidden");}, MSG_STAGGER);
  if (game.playertotal > game.dealertotal) {
    //flipDealerCards()
    setTimeout(function() {$MSGAREA.append(make$P("You win!").addClass("win").addClass("nomargin"));}, 2*MSG_STAGGER);
    appendNewGameButton();
    gameIsOverSoFlipAllCards();
  } else if (game.playertotal === game.dealertotal) {
    //flipDealerCards()
    setTimeout(function(){$MSGAREA.append(make$P("Push!").addClass("nomargin"));}, 2*MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  } else {
    //flipDealerCards()
    setTimeout(function(){$MSGAREA.append(make$P("You lose!").addClass("lose").addClass("nomargin"));}, 2*MSG_STAGGER);
    gameIsOverSoFlipAllCards();
    appendNewGameButton();
  }
}

function insertPlayerCards(card_arr) {
  card_arr.forEach(function(card_obj) {
    var $card = generateBack$IMG(card_obj);
    $PLAYERHAND.append($card);
  })
}

function generateFront$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS"){
    card_obj.image = "images/AceOfDiamonds.png";
  }
  var $card = $("<img src='" + card_obj.image + "'>");
  return $card;
}

function generateBack$IMG(card_obj) {
  if (card_obj.value === "ACE" && card_obj.suit === "DIAMONDS"){
    card_obj.image = "images/AceOfDiamonds.png";
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
      setTimeout(function(){delayedFlip()}, DEALER_CASCADE_FLIP_TIME);
    }
  }
  setTimeout(function(){delayedFlip();}, DEALER_CASCADE_FLIP_TIME);
}

function flipPlayerCards() {
  // if the player busts, don't want to spend any time waiting
  // to flip the card that led to the bust
  var img_arr = [].slice.call(document.querySelectorAll(".player-hand img"));
  var i = 0;
  var length = img_arr.length;
  function delayedFlip() {
    if (i < length) {
      if (img_arr[i].getAttribute("front_url") !== img_arr[i].getAttribute("src")){
        function needThisForClosure(i){
          var cardFlip = setTimeout(function(){
            img_arr[i].src = img_arr[i].getAttribute("front_url");
            if (game.playertotal > 21) {
              playerBusts();
              return
            }
            delayedFlip();
          }, CASCADE_FLIP_TIME);
          cardflip_events.push(cardFlip);
        }
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
  cardflip_events.forEach(function(event) {
    clearTimeout(event);
  })
  var img_arr = [].slice.call(document.querySelectorAll(".player-hand img"));
  img_arr.forEach(function(card) {
    if (card.getAttribute("front_url") && card.getAttribute("front_url") !== card.getAttribute("src")){
      card.src = card.getAttribute("front_url");
    }
  })
}
