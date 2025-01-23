let SHEET_URL;
let dataMap = {};
let notifications = [];
let isMicUsed = false;
let isSpeaking = false;
let isListening = false;
let SECRET_KEY;
const vocabulary = [];
fetch('config.json')
    .then(response => response.json())
    .then(config => {
        SECRET_KEY = config.secret_key;
        loadChatHistory();
        loadNotifications();
    })
    .catch(error => console.error('Error loading config:', error));

function encryptMessage(message) {
    return CryptoJS.AES.encrypt(message, SECRET_KEY).toString();
}

function decryptMessage(ciphertext) {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
}

function startDictation() {
    const micButton = document.getElementById('micButton');
    micButton.classList.add('active');

    if (window.SpeechRecognition || window.webkitSpeechRecognition) {
        const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
        recognition.lang = 'vi-VN';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.start();
        isListening = true;

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            isMicUsed = true;
            sendMessage(transcript);
            recognition.stop();
            isListening = false;
        };

        recognition.onerror = function (event) {
            console.error("Speech recognition error detected: " + event.error);
            recognition.stop();
            isListening = false;
        };

        recognition.onend = function () {
            micButton.classList.remove('active');
            console.log("Speech recognition service disconnected");
            isListening = false;
        };
    } else {
        alert('Trình duyệt của bạn không hỗ trợ chức năng nhận diện giọng nói.');
    }
}

function setCookie(name, value, days) {
    document.cookie = `${name}=${encodeURIComponent(value)}; expires=${new Date(Date.now() + days * 864e5).toUTCString()}; path=/; Secure; SameSite=Strict`;
}

function getCookie(name) {
    return document.cookie.split('; ').reduce((r, v) => {
        const parts = v.split('=');
        return parts[0] === name ? decodeURIComponent(parts[1]) : r;
    }, '');
}

function saveChatHistory() {
    setCookie('chatHistory', document.getElementById('messages').innerHTML, 7);
}

function loadChatHistory() {
    const chatHistory = getCookie('chatHistory');
    const storedDataMap = getCookie('dataMap');
    if (storedDataMap) {
        dataMap = JSON.parse(storedDataMap);
    }
    if (chatHistory) {
        document.getElementById('messages').innerHTML = chatHistory;
        document.getElementById('messages').scrollTop = document.getElementById('messages').scrollHeight;
    }
}

function loadNotifications() {
    if (notifications.length > 0) {
        notifications.forEach(notification => {
            const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            displayMessage(notification, 'bot', timestamp);
        });
    }
}

fetch('config.json')
    .then(response => response.json())
    .then(config => {
        SHEET_URL = config.sheet_url;
        return fetch(SHEET_URL);
    })
    .then(response => response.text())
    .then(data => {
        const json = JSON.parse(data.substr(47).slice(0, -2));
        json.table.rows.forEach(row => {
            const question = row.c[0]?.v.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()]/g, "");
            const answer = row.c[1]?.v;
            const notification = row.c[4]?.v;

            if (question && answer) {
                dataMap[question] = answer;
                vocabulary.push(...question.split(' '));
            }
            if (notification) {
                notifications.push(notification);
            }
        });
        loadChatHistory();
        loadNotifications();
    })
    .catch(error => console.error('Error:', error));

function validateInput(input) {
    const illegalChars = /[<>]/;
    return !illegalChars.test(input);
}

function sendMessage(message) {
    const input = document.getElementById('userInput');
    const normalizedMessage = message.trim();

    if (!validateInput(normalizedMessage)) {
        displayMessage("Đầu vào không hợp lệ!", 'bot');
        return;
    }

    if (!normalizedMessage) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    displayMessage(normalizedMessage, 'user', timestamp);
    input.value = '';

    showTypingIndicator();

    const response = autoReply(normalizedMessage);
    setTimeout(() => {
        hideTypingIndicator();
        displayMessage(response, 'bot', timestamp);
        saveChatHistory();

        if (isMicUsed && !isSpeaking) {
            speakText(response);
        }

        isMicUsed = false;
    }, 1000);
}

function displayMessage(message, sender, timestamp) {
    const messages = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const formattedMessage = decryptMessage(encryptMessage(message)).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: navy; text-decoration: none;">Liên kết</a>');

    messageDiv.innerHTML = `
        <div>${formattedMessage}</div>
        <div class="message-footer">
            <span class="sender">${sender === 'user' ? 'Bạn' : 'CĐ ITC'}</span>
            <span class="timestamp">${timestamp}</span>
        </div>`;

    messages.appendChild(messageDiv);
    messages.scrollTop = messages.scrollHeight;
}

function speakText(text) {
    if (typeof responsiveVoice !== 'undefined') {
        const language = 'Vietnamese Female';
        responsiveVoice.speak(text, language, {
            onstart: function () {
                isSpeaking = true;
                document.getElementById('micButton').disabled = true;
            },
            onend: function () {
                isSpeaking = false;
                document.getElementById('micButton').disabled = false;
            }
        });
    } else {
        console.error('ResponsiveVoice is not loaded.');
    }
}

function showTypingIndicator() {
    document.getElementById('typing').style.display = 'block';
}

function hideTypingIndicator() {
    document.getElementById('typing').style.display = 'none';
}

function cosineSimilarity(vecA, vecB) {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magnitudeA = Math.sqrt(vecA.reduce((sum, val) => sum + val ** 2, 0));
    const magnitudeB = Math.sqrt(vecB.reduce((sum, val) => sum + val ** 2, 0));
    return dotProduct / (magnitudeA * magnitudeB);
}

function vectorize(text) {
    const words = text.split(' ');
    const vector = new Array(vocabulary.length).fill(0);
    words.forEach(word => {
        const index = vocabulary.indexOf(word);
        if (index !== -1) {
            vector[index]++;
        }
    });
    return vector;
}

function autoReply(message) {
    const normalizedMessage = message.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()]/g, "");
    const userVector = vectorize(normalizedMessage);
    let bestMatch = null, bestScore = -1;

    for (const question in dataMap) {
        const questionVector = vectorize(question);
        const similarity = cosineSimilarity(userVector, questionVector);

        if (similarity > bestScore) {
            bestScore = similarity;
            bestMatch = dataMap[question];
        }
    }

    return bestMatch || "Hiện tại tôi chưa thể trả lời câu hỏi của bạn.";
}

document.getElementById('userInput').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage(this.value);
        this.value = '';
    }
});

document.getElementById('micButton').addEventListener('click', function () {
    if (!isSpeaking && !isListening) {
        isMicUsed = true;
        startDictation();
    }
});

window.onload = function () {
    loadChatHistory();
    loadNotifications();
};
