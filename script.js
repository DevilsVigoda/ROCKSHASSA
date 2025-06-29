// Глобальные переменные
let socket;
let playerId;
let roomCode;
let playerName;
let gameState = {};
let selectedCardId = null;
let lastSelectedCardElement = null; // Добавляем переменную для хранения последней выбранной кар

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
    
    // Подключаемся к "серверу" (эмуляция через localStorage)
    connectToRoom();
}

// Эмуляция подключения к серверу через localStorage
function connectToRoom() {
    // В реальном приложении здесь было бы WebSocket соединение
    // Для демонстрации используем localStorage и таймер
    
    // Загружаем состояние комнаты
    loadRoomState();
    
    // Обновляем интерфейс
    updateGameUI();
    
    // Запускаем "прослушку" изменений
	setInterval(loadRoomState, 2000);
}

function loadRoomState() {
    const roomData = localStorage.getItem(`imaginarium_room_${roomCode}`);
    if (roomData) {
        gameState = JSON.parse(roomData);
        updateGameUI();
    } else {
        // Комната не найдена
        alert('Комната не найдена или была удалена');
        window.location.href = 'index.html';
    }
}

function saveRoomState() {
    localStorage.setItem(`imaginarium_room_${roomCode}`, JSON.stringify(gameState));
    // Триггерим событие для других вкладок
    localStorage.setItem(`imaginarium_update_${roomCode}`, Date.now().toString());
}

// Создание новой комнаты
function createRoom() {
    playerName = prompt('Введите ваше имя:', 'Игрок' + Math.floor(Math.random() * 1000));
    if (!playerName) return;
    
    // Генерируем код комнаты
    roomCode = generateRoomCode();
    playerId = generatePlayerId();
    
    // Создаем состояние игры
    gameState = {
        phase: 'waiting',
        players: [{
            id: playerId,
            name: playerName,
            score: 0,
            isHost: true,
            cards: generatePlayerCards()
        }],
        deck: generateDeck(),
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
    
    // Сохраняем состояние
    saveRoomState();
    
    // Переходим в комнату
    window.location.href = `game.html?room=${roomCode}&player=${playerId}`;
}

// Присоединение к комнате
function joinRoom() {
    const code = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    if (!code || code.length !== 6) {
        alert('Код комнаты должен состоять из 6 символов');
        return;
    }
    
    playerName = prompt('Введите ваше имя:', 'Игрок' + Math.floor(Math.random() * 1000));
    if (!playerName) return;
    
    // Проверяем существование комнаты
    const roomData = localStorage.getItem(`imaginarium_room_${code}`);
    if (!roomData) {
        alert('Комната с таким кодом не найдена');
        return;
    }
    
    roomCode = code;
    playerId = generatePlayerId();
    
    // Получаем состояние комнаты
    gameState = JSON.parse(roomData);
    
    // Добавляем игрока
    if (gameState.players.length >= 8) {
        alert('В комнате уже максимальное количество игроков (8)');
        return;
    }
    
    gameState.players.push({
        id: playerId,
        name: playerName,
        score: 0,
        isHost: false,
        cards: generatePlayerCards()
    });
    
    // Сохраняем состояние
    saveRoomState();
    
    // Переходим в комнату
    window.location.href = `game.html?room=${roomCode}&player=${playerId}`;
}

// Покидание комнаты
function leaveRoom() {
    if (confirm('Вы уверены, что хотите покинуть комнату?')) {
        // Удаляем игрока из состояния
        gameState.players = gameState.players.filter(p => p.id !== playerId);
        
        // Если это был хост, назначаем нового
        const wasHost = gameState.players.find(p => p.id === playerId)?.isHost;
        if (wasHost && gameState.players.length > 0) {
            gameState.players[0].isHost = true;
        }
        
        // Если комната пуста, удаляем ее
        if (gameState.players.length === 0) {
            localStorage.removeItem(`imaginarium_room_${roomCode}`);
        } else {
            saveRoomState();
        }
        
        window.location.href = 'index.html';
    }
}

// Начало игры
function startGame() {
    if (gameState.players.length < 3) {
        alert('Для начала игры нужно минимум 3 игрока');
        return;
    }
    
    gameState.phase = 'association';
    gameState.currentRound.leader = getNextLeader();
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
    
    // Записываем ассоциацию
    gameState.currentRound.association = association;
    gameState.currentRound.cards = [{
        cardId: selectedCardId,
        playerId: playerId,
        isOriginal: true
    }];
    
    // Удаляем карту из руки игрока
    const player = gameState.players.find(p => p.id === playerId);
    player.cards = player.cards.filter(c => c.id !== selectedCardId);
    
    // Переходим к следующей фазе
    gameState.phase = 'chooseCard';
    saveRoomState();
}

// Выбор карты для ассоциации
function submitCardChoice() {
    if (!selectedCardId) {
        alert('Выберите карту');
        return;
    }
    
    // Добавляем карту в раунд
    gameState.currentRound.cards.push({
        cardId: selectedCardId,
        playerId: playerId,
        isOriginal: false
    });
    
    // Удаляем карту из руки игрока
    const player = gameState.players.find(p => p.id === playerId);
    player.cards = player.cards.filter(c => c.id !== selectedCardId);
    
    // Проверяем, все ли игроки (кроме ведущего) выбрали карты
    const leaderId = gameState.currentRound.leader;
    const playersWhoChose = gameState.currentRound.cards.map(c => c.playerId);
    const allPlayersChose = gameState.players
        .filter(p => p.id !== leaderId)
        .every(p => playersWhoChose.includes(p.id));
    
    if (allPlayersChose) {
        // Перемешиваем карты
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
    
    // Записываем голос
    gameState.currentRound.votes[playerId] = selectedCardId;
    
    // Проверяем, все ли проголосовали
    const allPlayersVoted = gameState.players.every(p => 
        p.id === gameState.currentRound.leader || gameState.currentRound.votes[p.id]);
    
    if (allPlayersVoted) {
        calculateRoundResults();
        gameState.phase = 'results';
    }
    
    saveRoomState();
}

// Переход к следующему раунду
function nextRound() {
    gameState.roundsPlayed++;
    
    // Проверяем, не закончилась ли игра
    if (gameState.roundsPlayed >= 6) {
        gameState.phase = 'gameOver';
    } else {
        // Сдаем новые карты игрокам
        dealCards();
        
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
    
    // Сдаем новые карты
    gameState.players.forEach(player => {
        player.cards = generatePlayerCards();
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

// Обновление интерфейса в соответствии с состоянием игры
function updateGameUI() {
    // Обновляем список игроков
    updatePlayersList();
    
    // Показываем соответствующую фазу игры
    document.querySelectorAll('.game-phase').forEach(el => el.classList.add('hidden'));
    
    switch (gameState.phase) {
        case 'waiting':
            document.getElementById('waitingPhase').classList.remove('hidden');
            // Активируем кнопку "Начать игру" только для хоста
            const isHost = gameState.players.find(p => p.id === playerId)?.isHost;
            document.getElementById('startGameBtn').disabled = !isHost;
            break;
            
        case 'association':
            if (gameState.currentRound.leader === playerId) {
                document.getElementById('associationPhase').classList.remove('hidden');
                renderPlayerCards('playerCards');
            } else {
                document.getElementById('waitingPhase').classList.remove('hidden');
                document.querySelector('#waitingPhase h2').textContent = 
                    `Ожидание ассоциации от ${getPlayerName(gameState.currentRound.leader)}...`;
            }
            break;
            
        case 'chooseCard':
            if (gameState.currentRound.leader === playerId) {
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
            break;
            
        case 'gameOver':
            document.getElementById('gameOverPhase').classList.remove('hidden');
            renderFinalResults();
            break;
    }
}

// Обновление списка игроков
function updatePlayersList() {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';
    
    gameState.players.forEach(player => {
        const badge = document.createElement('div');
        badge.className = 'player-badge';
        badge.textContent = player.name + (player.isHost ? ' 👑' : '') + ` (${player.score})`;
        playersList.appendChild(badge);
    });
    
    document.getElementById('playersCount').textContent = 
        `${gameState.players.length} ${pluralize(gameState.players.length, 'игрок', 'игрока', 'игроков')}`;
}

// Обработчик наведения на карту
function handleCardHover(event) {
    const hoveredCard = event.currentTarget;
    
    // Если есть выбранная карта и наводим на другую - снимаем обработчики
    if (selectedCardId && hoveredCard !== lastSelectedCardElement) {
        document.querySelectorAll('.card').forEach(card => {
            card.removeEventListener('mouseenter', handleCardHover);
        });
        
        if (lastSelectedCardElement) {
            lastSelectedCardElement.classList.remove('selected');
        }
        selectedCardId = null;
        lastSelectedCardElement = null;
    }
}

// Рендер карт игрока
function renderPlayerCards(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';
    
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;

    player.cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.cardId = card.id;
        
        const img = document.createElement('div');
        img.className = 'card-img';
        img.textContent = `🖼️ ${card.id}`;
        cardEl.appendChild(img);

        // Восстанавливаем выделение, если карта была выбрана ранее
        if (card.id === selectedCardId) {
            cardEl.classList.add('selected');
        }

        cardEl.addEventListener('click', () => selectCard(cardEl, card.id));
        container.appendChild(cardEl);
    });
}

// Рендер карт на столе
function renderTableCards() {
    const container = document.getElementById('tableCards');
    container.innerHTML = '';

    gameState.currentRound.cards.forEach(card => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.cardId = card.cardId;

        const img = document.createElement('div');
        img.className = 'card-img';
        img.textContent = `🖼️ ${card.cardId}`;
        cardEl.appendChild(img);

        // Восстанавливаем выделение, если карта была выбрана ранее
        if (card.cardId === selectedCardId) {
            cardEl.classList.add('selected');
        }

        cardEl.addEventListener('click', () => selectCard(cardEl, card.cardId));
        container.appendChild(cardEl);
    });
}

// Рендер результатов раунда
function renderRoundResults() {
    const container = document.getElementById('roundResults');
    container.innerHTML = '';
    
    const originalCard = gameState.currentRound.cards.find(c => c.isOriginal);
    const originalCardId = originalCard.cardId;
    
    // Собираем статистику по голосам
    const votesStats = {};
    Object.values(gameState.currentRound.votes).forEach(cardId => {
        votesStats[cardId] = (votesStats[cardId] || 0) + 1;
    });
    
    // Добавляем информацию о каждой карте
    gameState.currentRound.cards.forEach(card => {
        const item = document.createElement('div');
        item.className = 'result-item';
        
        const cardInfo = document.createElement('p');
        cardInfo.textContent = `Карта ${card.cardId} (${card.isOriginal ? 'оригинал' : 'от ' + getPlayerName(card.playerId)})`;
        
        const votesInfo = document.createElement('p');
        const votesCount = votesStats[card.cardId] || 0;
        votesInfo.textContent = `Голосов: ${votesCount}`;
        
        item.appendChild(cardInfo);
        item.appendChild(votesInfo);
        container.appendChild(item);
    });
    
    // Добавляем информацию о начисленных очках
    const scoresInfo = document.createElement('div');
    scoresInfo.className = 'result-item';
    scoresInfo.innerHTML = '<h3>Начисленные очки:</h3>';
    
    Object.entries(gameState.currentRound.results).forEach(([playerId, points]) => {
        const p = document.createElement('p');
        p.textContent = `${getPlayerName(playerId)}: ${points} ${pluralize(points, 'очко', 'очка', 'очков')}`;
        scoresInfo.appendChild(p);
    });
    
    container.appendChild(scoresInfo);
}

// Рендер финальных результатов
function renderFinalResults() {
    const container = document.getElementById('finalResults');
    container.innerHTML = '<h3>Итоговые результаты:</h3>';
    
    // Сортируем игроков по очкам
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);
    
    sortedPlayers.forEach((player, index) => {
        const p = document.createElement('p');
        p.textContent = `${index + 1}. ${player.name}: ${player.score} ${pluralize(player.score, 'очко', 'очка', 'очков')}`;
        container.appendChild(p);
    });
}

// Выбор карты
function selectCard(cardElement, cardId) {
    // Если кликаем на уже выбранную карту - снимаем выделение
    if (selectedCardId === cardId) {
        cardElement.classList.remove('selected');
        selectedCardId = null;
        lastSelectedCardElement = null;
        return;
    }
    
    // Снимаем выделение со всех карт
    document.querySelectorAll('.card').forEach(card => {
        card.classList.remove('selected');
    });
    
    // Выделяем выбранную карту
    cardElement.classList.add('selected');
    selectedCardId = cardId;
    lastSelectedCardElement = cardElement;
    
    // Добавляем обработчик для снятия выделения при наведении на другие карты
    document.querySelectorAll('.card').forEach(card => {
        if (card !== cardElement) {
            card.addEventListener('mouseenter', handleCardHover);
        }
    });
}

// Расчет результатов раунда
function calculateRoundResults() {
    const originalCard = gameState.currentRound.cards.find(c => c.isOriginal);
    const originalCardId = originalCard.cardId;
    const leaderId = gameState.currentRound.leader;
    
    // Собираем статистику по голосам
    const votesStats = {};
    Object.entries(gameState.currentRound.votes).forEach(([voterId, cardId]) => {
        votesStats[cardId] = (votesStats[cardId] || 0) + 1;
    });
    
    // Начисляем очки ведущему за каждого угадавшего его карту
    const correctVotes = votesStats[originalCardId] || 0;
    gameState.currentRound.results[leaderId] = correctVotes * 2;
    
    // Начисляем очки игрокам за угаданные карты
    Object.entries(gameState.currentRound.votes).forEach(([voterId, cardId]) => {
        if (cardId === originalCardId) {
            // Игрок угадал оригинальную карту
            gameState.currentRound.results[voterId] = (gameState.currentRound.results[voterId] || 0) + 3;
        } else if (votesStats[cardId] > 0) {
            // Игрок проголосовал за карту, которая получила голоса
            gameState.currentRound.results[voterId] = (gameState.currentRound.results[voterId] || 0) + 1;
        }
    });
    
    // Начисляем дополнительные очки, если никто не угадал оригинальную карту
    if (correctVotes === 0) {
        // Все игроки, кроме ведущего, получают по 2 очка
        gameState.players.forEach(player => {
            if (player.id !== leaderId) {
                gameState.currentRound.results[player.id] = (gameState.currentRound.results[player.id] || 0) + 2;
            }
        });
    }
    
    // Обновляем общий счет игроков
    Object.entries(gameState.currentRound.results).forEach(([playerId, points]) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (player) {
            player.score += points;
        }
    });
    
    // Перемещаем карты в сброс
    gameState.currentRound.cards.forEach(card => {
        gameState.discarded.push({id: card.cardId});
    });
}

// Раздача карт игрокам
function dealCards() {
    gameState.players.forEach(player => {
        // Добираем карты до 6
        while (player.cards.length < 6 && gameState.deck.length > 0) {
            player.cards.push(gameState.deck.pop());
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

// Генерация колоды карт
function generateDeck() {
    const cards = [];
    // В реальной игре здесь было бы 98 уникальных карт
    for (let i = 1; i <= 98; i++) {
        cards.push({id: i});
    }
    return shuffleArray(cards);
}

// Генерация начальных карт игрока
function generatePlayerCards() {
    const cards = [];
    for (let i = 0; i < 6; i++) {
        // В реальной игре карты брались бы из колоды
        cards.push({id: Math.floor(Math.random() * 98) + 1});
    }
    return cards;
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