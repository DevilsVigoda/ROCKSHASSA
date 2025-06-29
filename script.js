// Глобальные переменные
let socket;
let playerId;
let roomCode;
let playerName;
let gameState = {};
let selectedCardId = null;
let lastSelectedCardElement = null;
const GITHUB_TOKEN = ''; // <-- Сюда вставь твой токен
const REPO_OWNER = 'DevislVigoda';
const REPO_NAME = 'imaginarium'; // название твоего репозитория


async function loadToken() {
    try {
        const response = await fetch('token.json?nocache=' + Date.now());
        if (response.ok) {
            const data = await response.json();
            GITHUB_TOKEN = data.token;
        } else {
            console.error("Не удалось загрузить token.json");
        }
    } catch (err) {
        console.error("Ошибка при загрузке token.json:", err);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    // Определяем, на какой странице мы находимся
    if (document.getElementById('createRoomBtn')) {
        initMainPage();
    } else if (document.getElementById('roomCodeDisplay')) {
        initGamePage();
    }
});

// Инициализация главной страницы
function initMainPage() {
    document.getElementById('createRoomBtn').addEventListener('click', createRoom);
    document.getElementById('joinRoomBtn').addEventListener('click', joinRoom);
}

// Инициализация игровой страницы
function initGamePage() {
    // Получаем параметры из URL
    const urlParams = new URLSearchParams(window.location.search);
    roomCode = urlParams.get('room');
    playerId = urlParams.get('player');
    
    if (!roomCode || !playerId) {
        alert('Неверная ссылка на комнату');
        window.location.href = 'index.html';
        return;
    }
    
    // Отображаем код комнаты
    document.getElementById('roomCodeDisplay').textContent = roomCode;
    document.getElementById('shareRoomCode').textContent = roomCode;
    
    // Настраиваем кнопки
    document.getElementById('leaveRoomBtn').addEventListener('click', leaveRoom);
    document.getElementById('startGameBtn').addEventListener('click', startGame);
    document.getElementById('submitAssociationBtn').addEventListener('click', submitAssociation);
    document.getElementById('submitCardChoiceBtn').addEventListener('click', submitCardChoice);
    document.getElementById('submitVoteBtn').addEventListener('click', submitVote);
    document.getElementById('nextRoundBtn').addEventListener('click', nextRound);
    document.getElementById('newGameBtn').addEventListener('click', newGame);
    
    // Подключаемся к комнате
	loadToken().then(() => {
        connectToRoom(); // только после загрузки токена
    });
    connectToRoom();
}

// Подключение к комнате
function connectToRoom() {
    loadRoomState();
    updateGameUI();
    setInterval(loadRoomState, 1000);
}

async function loadRoomState() {
    if (!roomCode) return;

   const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/rooms/room_${roomCode}.json`;

    try {
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            }
        });

        if (response.ok) {
            const data = await response.json();
            const decodedContent = atob(data.content);
            const newState = JSON.parse(decodedContent);

            if (JSON.stringify(gameState) !== JSON.stringify(newState)) {
                gameState = newState;
                updateGameUI();
            }
        } else {
            alert('Комната не найдена');
            window.location.href = 'index.html';
        }
    } catch (err) {
        console.error("Ошибка загрузки:", err);
    }
}

async function saveRoomState() {
    if (!roomCode || !GITHUB_TOKEN) return;

    const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/rooms/room_${roomCode}.json`;
    const content = btoa(unescape(encodeURIComponent(JSON.stringify(gameState, null, 2))));
    const data = {
        message: "Update room state",
        content: content,
    };

    try {
        const shaResponse = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            }
        });

        if (shaResponse.ok) {
            const shaData = await shaResponse.json();
            data.sha = shaData.sha;
        }

        await fetch(url, {
            method: "PUT",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            },
            body: JSON.stringify(data)
        });

    } catch (err) {
        console.error("Ошибка сохранения:", err);
    }
}

// Создание новой комнаты
function createRoom() {
    playerName = prompt('Введите ваше имя:', 'Игрок' + Math.floor(Math.random() * 1000));
    if (!playerName) return;

    roomCode = generateRoomCode();
    playerId = generatePlayerId();

    const deck = generateDeck();
   gameState = {
    phase: 'waiting',
    players: [{
        id: playerId,
        name: playerName,
        score: 0,
        isHost: true,
        cards: dealInitialCards(deck)
    }],
    deck: deck,
    discarded: [],
    currentRound: {
        leader: playerId,
        association: '',
        cards: [],
        votes: {},
        results: {}
    },
    roundsPlayed: 0
};

    saveRoomState();
    window.location.href = `game.html?room=${roomCode}&player=${playerId}`;
}

// Присоединение к комнате
async function joinRoom() {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        alert('Код комнаты должен состоять из 6 символов');
        return;
    }

    playerName = prompt('Введите ваше имя:', 'Игрок' + Math.floor(Math.random() * 1000));
    if (!playerName) return;

    roomCode = code;
    playerId = generatePlayerId();

    await loadRoomState(); // загружаем текущее состояние комнаты

    if (gameState.players.length >= 8) {
        alert('В комнате уже максимальное количество игроков (8)');
        return;
    }

    const newPlayerCards = dealInitialCards(gameState.deck);
    gameState.players.push({
        id: playerId,
        name: playerName,
        score: 0,
        isHost: false,
        cards: newPlayerCards
    });

    await saveRoomState(); // сохраняем обновлённое состояние

    window.location.href = `game.html?room=${roomCode}&player=${playerId}`;
}

// Раздача начальных карт (6 штук)
function dealInitialCards(deck) {
    const cards = [];
    for (let i = 0; i < 6 && deck.length > 0; i++) {
        cards.push(deck.pop());
    }
    return cards;
}

// Покидание комнаты
async function leaveRoom() {
    if (confirm('Вы уверены, что хотите покинуть комнату?')) {
        const playerIndex = gameState.players.findIndex(p => p.id === playerId);
        if (playerIndex !== -1) {
            // Возвращаем карты игрока в колоду
            gameState.deck = [...gameState.deck, ...gameState.players[playerIndex].cards];
            // Удаляем игрока
            gameState.players.splice(playerIndex, 1);

            // Если это был хост и остались игроки, назначаем нового хоста
            if (playerIndex === 0 && gameState.players.length > 0) {
                gameState.players[0].isHost = true;
            }

            // Если комната пуста, удаляем файл
            if (gameState.players.length === 0) {
                await deleteRoomFile();
            } else {
                await saveRoomState();
            }
        }

        window.location.href = 'index.html';
    }
}

// Удаление файла комнаты
async function deleteRoomFile() {
    const url = `https://api.github.com/repos/ ${REPO_OWNER}/${REPO_NAME}/contents/rooms/room_${roomCode}.json`;

    try {
        const shaResponse = await fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${GITHUB_TOKEN}`,
                Accept: "application/vnd.github.v3+json"
            }
        });

        if (shaResponse.ok) {
            const shaData = await shaResponse.json();

            await fetch(url, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${GITHUB_TOKEN}`,
                    Accept: "application/vnd.github.v3+json"
                },
                body: JSON.stringify({
                    message: "Delete room file",
                    sha: shaData.sha
                })
            });
        }
    } catch (err) {
        console.error("Ошибка удаления файла комнаты:", err);
    }
}

// Начало игры
function startGame() {
    if (gameState.players.length < 3) {
        alert('Для начала игры нужно минимум 3 игрока');
        return;
    }
    
    // Перемешиваем колоду
    gameState.deck = shuffleArray([...gameState.deck, ...gameState.discarded]);
    gameState.discarded = [];
    
    // Раздаем карты игрокам
    gameState.players.forEach(player => {
        while (player.cards.length < 6 && gameState.deck.length > 0) {
            player.cards.push(gameState.deck.pop());
        }
    });
    
    gameState.phase = 'association';
    gameState.currentRound.leader = getNextLeader();
    gameState.roundsPlayed = 0;
    saveRoomState();
	
}

// Отправка ассоциации
function submitAssociation() {
    const association = document.getElementById('associationInput').value.trim();
    if (!association) {
        alert('Введите ассоциацию');
        return;
    }
    
    if (!selectedCardId) {
        alert('Выберите карту');
        return;
    }
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    gameState.currentRound.association = association;
    gameState.currentRound.cards = [{
        cardId: selectedCardId,
        playerId: playerId,
        isOriginal: true
    }];
    
    // Удаляем карту из руки игрока
    player.cards = player.cards.filter(c => c.id !== selectedCardId);
    selectedCardId = null;
    
    gameState.phase = 'chooseCard';
    saveRoomState();
	
}

// Выбор карты для ассоциации
function submitCardChoice() {
    if (!selectedCardId) {
        alert('Выберите карту');
        return;
    }
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    // Проверяем, что игрок еще не выбрал карту
    const alreadyChose = gameState.currentRound.cards.some(c => c.playerId === playerId);
    if (alreadyChose) {
        alert('Вы уже выбрали карту для этого раунда');
        return;
    }
    
    gameState.currentRound.cards.push({
        cardId: selectedCardId,
        playerId: playerId,
        isOriginal: false
    });
    
    // Удаляем карту из руки игрока
    player.cards = player.cards.filter(c => c.id !== selectedCardId);
    selectedCardId = null;
    
    // Проверяем, все ли игроки (кроме ведущего) выбрали карты
    const leaderId = gameState.currentRound.leader;
    const playersWhoChose = gameState.currentRound.cards.map(c => c.playerId);
    const allPlayersChose = gameState.players
        .filter(p => p.id !== leaderId)
        .every(p => playersWhoChose.includes(p.id));
    
    if (allPlayersChose) {
        gameState.currentRound.cards = shuffleArray(gameState.currentRound.cards);
        gameState.phase = 'voting';
    }
    
    saveRoomState();
	
}

// Голосование
function submitVote() {
    if (!selectedCardId) {
        alert('Выберите карту для голосования');
        return;
    }
    
    // Проверяем, что игрок еще не голосовал
    if (gameState.currentRound.votes[playerId]) {
        alert('Вы уже проголосовали в этом раунде');
        return;
    }
    
    gameState.currentRound.votes[playerId] = selectedCardId;
    selectedCardId = null;
    
    // Проверяем, все ли проголосовали (кроме ведущего)
    const leaderId = gameState.currentRound.leader;
    const allPlayersVoted = gameState.players
        .filter(p => p.id !== leaderId)
        .every(p => gameState.currentRound.votes[p.id]);
    
    if (allPlayersVoted) {
        calculateRoundResults();
        gameState.phase = 'results';
    }
    
    saveRoomState();
	
}

// Переход к следующему раунду
function nextRound() {
    gameState.roundsPlayed++;
    
    // Перемещаем карты раунда в сброс
    gameState.currentRound.cards.forEach(card => {
        gameState.discarded.push({id: card.cardId});
    });
    
    // Проверяем, не закончилась ли игра
    if (gameState.roundsPlayed >= 6) {
        gameState.phase = 'gameOver';
    } else {
        // Раздаем новые карты игрокам
        gameState.players.forEach(player => {
            while (player.cards.length < 6 && gameState.deck.length > 0) {
                player.cards.push(gameState.deck.pop());
            }
        });
        
        // Начинаем новый раунд
        gameState.phase = 'association';
        gameState.currentRound = {
            leader: getNextLeader(),
            association: '',
            cards: [],
            votes: {},
            results: {}
        };
    }
    
    saveRoomState();
	
}

// Новая игра
function newGame() {
    // Перемешиваем колоду
    gameState.deck = shuffleArray([...gameState.deck, ...gameState.discarded]);
    gameState.discarded = [];
    
    // Сбрасываем очки
    gameState.players.forEach(p => p.score = 0);
    
    // Раздаем новые карты
    gameState.players.forEach(player => {
        player.cards = [];
        while (player.cards.length < 6 && gameState.deck.length > 0) {
            player.cards.push(gameState.deck.pop());
        }
    });
    
    // Начинаем новую игру
    gameState.phase = 'association';
    gameState.currentRound = {
        leader: getNextLeader(),
        association: '',
        cards: [],
        votes: {},
        results: {}
    };
    gameState.roundsPlayed = 0;
    
    saveRoomState();
	
}

// Обновление интерфейса
function updateGameUI() {
    updatePlayersList();
    
    // Скрываем все фазы
    document.querySelectorAll('.game-phase').forEach(el => el.classList.add('hidden'));
    
    const isHost = gameState.players.find(p => p.id === playerId)?.isHost;
    const isLeader = gameState.currentRound.leader === playerId;
    
    switch (gameState.phase) {
        case 'waiting':
            document.getElementById('waitingPhase').classList.remove('hidden');
            document.getElementById('startGameBtn').disabled = !isHost;
            break;
            
        case 'association':
            if (isLeader) {
                document.getElementById('associationPhase').classList.remove('hidden');
                renderPlayerCards('playerCards');
            } else {
                document.getElementById('waitingPhase').classList.remove('hidden');
                document.querySelector('#waitingPhase h2').textContent = 
                    `Ожидание ассоциации от ${getPlayerName(gameState.currentRound.leader)}...`;
            }
            break;
            
        case 'chooseCard':
            if (isLeader) {
                document.getElementById('waitingPhase').classList.remove('hidden');
                document.querySelector('#waitingPhase h2').textContent = 
                    'Ожидание выбора карт другими игроками...';
            } else {
                document.getElementById('chooseCardPhase').classList.remove('hidden');
                document.querySelector('#currentAssociationText span').textContent = 
                    gameState.currentRound.association;
                renderPlayerCards('chooseCards');
            }
            break;
            
        case 'voting':
            document.getElementById('votingPhase').classList.remove('hidden');
            document.querySelector('#votingAssociationText span').textContent = 
                gameState.currentRound.association;
            renderTableCards();
            break;
            
        case 'results':
            document.getElementById('resultsPhase').classList.remove('hidden');
            renderRoundResults();
            document.getElementById('nextRoundBtn').disabled = !isHost;
            break;
            
        case 'gameOver':
            document.getElementById('gameOverPhase').classList.remove('hidden');
            renderFinalResults();
            document.getElementById('newGameBtn').disabled = !isHost;
            break;
    }
}

// Обновление списка игроков
function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    if (!playersList) return;
    playersList.innerHTML = '';

    if (!gameState.players || !Array.isArray(gameState.players)) return;

    gameState.players.forEach(player => {
        const badge = document.createElement('div');
        badge.className = 'player-badge';
        if (player.id === gameState.currentRound?.leader) {
            badge.classList.add('leader');
        }
        badge.textContent = player.name + (player.isHost ? ' 👑' : '') + ` (${player.score})`;
        playersList.appendChild(badge);
    });

    const playersCount = document.getElementById('playersCount');
    if (playersCount && gameState.players?.length !== undefined) {
        playersCount.textContent = 
            `${gameState.players.length} ${pluralize(gameState.players.length, 'игрок', 'игрока', 'игроков')}`;
    }
}

// Рендер карт игрока
function renderPlayerCards(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    player.cards.forEach(card => {
        const cardEl = createCardElement(card.id, card.id === selectedCardId);
        cardEl.addEventListener('click', () => selectCard(cardEl, card.id));
        container.appendChild(cardEl);
    });
}

// Рендер карт на столе
function renderTableCards() {
    const container = document.getElementById('tableCards');
    container.innerHTML = '';

    gameState.currentRound.cards.forEach(card => {
        const cardEl = createCardElement(card.cardId, card.cardId === selectedCardId);
        cardEl.addEventListener('click', () => selectCard(cardEl, card.cardId));
        container.appendChild(cardEl);
    });
}

// Создание элемента карты
function createCardElement(cardId, isSelected = false) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    if (isSelected) cardEl.classList.add('selected');
    cardEl.dataset.cardId = cardId;

    const img = document.createElement('img');
    img.src = `images/cards/card_${cardId}.png`;
    img.alt = `Карта ${cardId}`;
    img.className = 'card-img';
    img.onerror = function() {
        this.src = 'images/reserv.png';
    };

    cardEl.appendChild(img);
    return cardEl;
}

// Рендер результатов раунда
function renderRoundResults() {
    const container = document.getElementById('roundResults');
    container.innerHTML = '';
    
    const originalCard = gameState.currentRound.cards.find(c => c.isOriginal);
    if (!originalCard) return;
    
    const originalCardId = originalCard.cardId;
    const votesStats = {};
    
    Object.values(gameState.currentRound.votes).forEach(cardId => {
        votesStats[cardId] = (votesStats[cardId] || 0) + 1;
    });
    
    // Отображаем все карты
    gameState.currentRound.cards.forEach(card => {
        const cardEl = createCardElement(card.cardId);
        const votesCount = votesStats[card.cardId] || 0;
        
        const info = document.createElement('div');
        info.className = 'card-info';
        info.innerHTML = `
            <p>${card.isOriginal ? 'Оригинальная карта' : 'От ' + getPlayerName(card.playerId)}</p>
            <p>Голосов: ${votesCount}</p>
        `;
        
        const item = document.createElement('div');
        item.className = 'result-item';
        item.appendChild(cardEl);
        item.appendChild(info);
        container.appendChild(item);
    });
    
    // Отображаем результаты
    const resultsDiv = document.createElement('div');
    resultsDiv.className = 'round-scores';
    resultsDiv.innerHTML = '<h3>Начисленные очки:</h3>';
    
    Object.entries(gameState.currentRound.results).forEach(([playerId, points]) => {
        resultsDiv.innerHTML += `<p>${getPlayerName(playerId)}: ${points} ${pluralize(points, 'очко', 'очка', 'очков')}</p>`;
    });
    
    container.appendChild(resultsDiv);
}

// Рендер финальных результатов
function renderFinalResults() {
    const container = document.getElementById('finalResults');
    container.innerHTML = '<h2>Итоговые результаты:</h2>';
    
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((player, index) => {
        const p = document.createElement('p');
        p.className = 'final-score';
        p.textContent = `${index + 1}. ${player.name}: ${player.score} ${pluralize(player.score, 'очко', 'очка', 'очков')}`;
        container.appendChild(p);
    });
}

// Выбор карты
function selectCard(cardElement, cardId) {
    // Снимаем выделение со всех карт
    document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
    });

    // Если кликаем на уже выбранную карту - снимаем выделение
    if (selectedCardId === cardId) {
        selectedCardId = null;
        lastSelectedCardElement = null;
        return;
    }

    // Выделяем новую карту
    cardElement.classList.add('selected');
    selectedCardId = cardId;
    lastSelectedCardElement = cardElement;
}

// Расчет результатов раунда
function calculateRoundResults() {
    const originalCard = gameState.currentRound.cards.find(c => c.isOriginal);
    if (!originalCard) return;
    
    const originalCardId = originalCard.cardId;
    const leaderId = gameState.currentRound.leader;
    const votesStats = {};
    
    // Считаем голоса
    Object.values(gameState.currentRound.votes).forEach(cardId => {
        votesStats[cardId] = (votesStats[cardId] || 0) + 1;
    });
    
    // Начисляем очки ведущему за каждого угадавшего его карту
    const correctVotes = votesStats[originalCardId] || 0;
    gameState.currentRound.results[leaderId] = correctVotes * 2;
    
    // Начисляем очки игрокам
    Object.entries(gameState.currentRound.votes).forEach(([voterId, cardId]) => {
        if (cardId === originalCardId) {
            // Угадал оригинальную карту
            gameState.currentRound.results[voterId] = (gameState.currentRound.results[voterId] || 0) + 3;
        } else if (votesStats[cardId] > 0) {
            // Проголосовал за карту, которая получила голоса
            gameState.currentRound.results[voterId] = (gameState.currentRound.results[voterId] || 0) + 1;
        }
    });
    
    // Если никто не угадал оригинальную карту
    if (correctVotes === 0) {
        gameState.players.forEach(player => {
            if (player.id !== leaderId) {
                gameState.currentRound.results[player.id] = (gameState.currentRound.results[player.id] || 0) + 2;
            }
        });
    }
    
    // Обновляем общий счет
    Object.entries(gameState.currentRound.results).forEach(([playerId, points]) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.score += points;
        }
    });
}

// Получение следующего ведущего
function getNextLeader() {
    if (!gameState.currentRound.leader) {
        return gameState.players[0].id;
    }
    
    const currentIndex = gameState.players.findIndex(p => p.id === gameState.currentRound.leader);
    const nextIndex = (currentIndex + 1) % gameState.players.length;
    return gameState.players[nextIndex].id;
}

// Получение имени игрока по ID
function getPlayerName(playerId) {
    const player = gameState.players.find(p => p.id === playerId);
    return player ? player.name : 'Неизвестный';
}

// Генерация ID игрока
function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9);
}

// Генерация кода комнаты
function generateRoomCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Генерация колоды карт (98 уникальных карт)
function generateDeck() {
    const cards = [];
    for (let i = 1; i <= 98; i++) {
        cards.push({id: i});
    }
    return shuffleArray(cards);
}

// Перемешивание массива
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// Склонение слов
function pluralize(number, one, few, many) {
    const n = Math.abs(number);
    if (n % 10 === 1 && n % 100 !== 11) {
        return one;
    }
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) {
        return few;
    }
    return many;
}