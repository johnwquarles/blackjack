var API_URL = "http://deckofcardsapi.com/api";
var API_PROXY = "https://jsonp.afeld.me/?url=";
var game;

startGame();

function startGame() {
  game = new Game();
  setDeckId();
}


function Game() {
  this.deck_id = "";
  this.dealer_cards = [];
  this.player_cards = [];
  this.playertotal = 0;
  this.dealertotal = 0;
  this.dealerFirstTurn = true;
}

function gameLoop() {
  dealerInitialTurn();
}

// set the deck_id by calling the API
// and go into the main loop (needs to be in the success function here)
// so that it starts *after* the deck ID has been retrieved and assigned.
function setDeckId() {
  $.get(API_PROXY + API_URL + "/shuffle/?deck_count=6", function(obj){
    game.deck_id = obj.deck_id;
    gameLoop();
  }, 'json');
}

// specify "player" or "dealer" and how many cards. Their array will be populated with the cards and the total updated (will make Aces worth
// 1 instead of 11 if it will prevent busting.
function dealCards(towhom, num, callback) {
  var get_url = API_PROXY + API_URL + "/draw/" + game.deck_id + "/?count=" + num;
  $.get(get_url, function(obj){
    if (towhom.toLowerCase() === "player") {
      game.player_cards = game.player_cards.concat(obj.cards);
      updateTotal("player");
    }
    else {
      game.dealer_cards = game.dealer_cards.concat(obj.cards);
      updateTotal("dealer");
    }
    callback();
  }, 'json');
}

// enter "player" or "dealer" into updateTotal. It will sum up the total of the cards,
// with aces in the back (so that it'll opt to become 1 to prevent busting) without modifying
// the card order (for display purposes).
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
function acesToBack(arr) {
  var return_arr = [];
  arr.forEach(function(card) {
    if (card.value === "ACE") {return_arr.push(card)}
    else {return_arr.unshift(card)}
  })
  return return_arr;
}

function dealerInitialTurn() {
  dealCards("dealer", 2, dealerLoop);
}

function dealerLoop() {
  if (game.dealerFirstTurn){
    alert("Dealer's first card : " + game.dealer_cards[0].value + " of " + game.dealer_cards[0].suit);
    game.dealerFirstTurn = false;
  }
  if (game.dealertotal < 17) {
    dealCards("dealer", 1, dealerLoop);
  } else {
    dealerTurnResult();
  }
}

function dealerTurnResult() {
  var dealer_hand = game.dealer_cards.map(function(card) {
    return " " + card.value + " of " + card.suit;
  })
  if (game.dealertotal === 21) {
    alert("Dealer's hand: " + dealer_hand + "\n\nBlackjack! Dealer wins!");
    newGamePrompt();
  }
  else if (game.dealertotal > 21) {
    alert("Dealer's hand: " + dealer_hand + "\n\nDealer busts! So you win!");
    newGamePrompt();
  } else {
    alert("player's turn")
    playerInitialTurn();
  }
}

function playerInitialTurn() {
  dealCards("player", 2, playerLoop);
}

function playerLoop() {
  var player_hand = game.player_cards.map(function(card) {
    return " " + card.value + " of " + card.suit;
  })
  alert("Your hand: " + player_hand);
  if (game.playertotal === 21) {
    alert("blackjack! You win!");
    newGamePrompt();
  } else if (game.playertotal > 21) {
    alert("You busted! You lose!");
    newGamePrompt();
  } else {
    var choice = confirm("Your total: " + game.playertotal + ". Hit?");
    if (choice === true) {
      dealCards("player", 1, playerLoop);
    } else {
      finalReckoning();
    }
  }
}

function finalReckoning() {
  alert("Dealer's total: " + game.dealertotal + "\n\nYour total: " + game.playertotal);
  if (game.playertotal > game.dealertotal) {
    alert("You win!");
  } else if (game.playertotal === game.dealertotal) {
    alert("OMFG it's a tie!");
  } else {
    alert("You lose!");
  }
  newGamePrompt();
}

function newGamePrompt() {
  var choice = confirm("new game?");
  if (choice === true) {
    startGame();
  }
}
