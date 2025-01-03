let SHEET_URL;
let dataMap = {};
let suggestionsList = [];
let notifications = [];
let isMicUsed = false;
let isSpeaking = false;
let isListening = false;
let notes = [];
let noteTimeouts = [];

function encodeHTML(str) {
    return str.replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
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

function openSearchModal() {
    document.getElementById('searchModal').style.display = "block";
}

function closeSearchModal() {
    document.getElementById('searchModal').style.display = "none";
}

window.onclick = function (event) {
    if (event.target == document.getElementById('searchModal')) {
        closeSearchModal();
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
        suggestionsList = Object.keys(dataMap);
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
            const notification = row.c[2]?.v;

            if (question && answer) {
                dataMap[question] = answer;
                suggestionsList.push(question);
            }
            if (notification) {
                notifications.push(notification);
            }
        });
        loadChatHistory();
        loadNotifications();
    })
    .catch(error => console.error('Error:', error));

function displaySuggestions(inputValue) {
    const suggestionsDiv = document.getElementById('suggestions');
    suggestionsDiv.innerHTML = '';
    const filteredSuggestions = suggestionsList.filter(suggestion =>
        suggestion.startsWith(inputValue.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()]/g, ""))
    );
    filteredSuggestions.forEach(suggestion => {
        const div = document.createElement('div');
        div.className = 'suggestion';
        div.textContent = suggestion;
        div.onclick = () => {
            sendMessage(suggestion);
        };
        suggestionsDiv.appendChild(div);
    });
}

function sendMessage(message) {
    const input = document.getElementById('userInput');
    const normalizedMessage = message.trim();
    if (!normalizedMessage) return;

    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    displayMessage(normalizedMessage, 'user', timestamp);
    input.value = '';

    if (normalizedMessage.startsWith('#note')) {
        handleNoteStart(normalizedMessage);
    } else if (normalizedMessage.startsWith('#endnote')) {
        handleNoteEnd();
    } else {
        showTypingIndicator();
        const response = autoReply(normalizedMessage);
        setTimeout(() => {
            hideTypingIndicator();
            displayMessage(response, 'bot', timestamp);
            saveChatHistory();
            checkAndAddNewQuestion(normalizedMessage, response);

            if (isMicUsed && !isSpeaking) {
                speakText(response);
            }

            isMicUsed = false;
        }, 1000);
    }
}

function handleNoteStart(message) {
    const noteContent = message.replace('#note', '').trim();
    if (!noteContent) {
        displayMessage("Vui lòng nhập nội dung ghi chú: cú pháp note + ND note", 'bot', new Date().toLocaleTimeString());
        return;
    }

    const reminderTime = prompt("Nhập thời gian nhắc nhở (ví dụ: 12:30):");
    if (!reminderTime || !/^([01]\d|2[0-3]):([0-5]\d)$/.test(reminderTime)) {
        displayMessage("Vui lòng nhập thời gian hợp lệ (hh:mm).", 'bot', new Date().toLocaleTimeString());
        return;
    }

    const [hours, minutes] = reminderTime.split(':').map(Number);
    const now = new Date();
    const reminderDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, minutes);

    if (reminderDate < now) {
        displayMessage("Thời gian nhắc nhở phải trong tương lai.", 'bot', new Date().toLocaleTimeString());
        return;
    }

    const note = {
        content: noteContent,
        time: reminderDate.getTime()
    };

    notes.push(note);
    localStorage.setItem('notes', JSON.stringify(notes));
    setReminder(note);
    displayMessage(`Ghi chú đã được lưu: "${noteContent}". Bạn sẽ nhận được nhắc nhở vào ${reminderDate.toLocaleTimeString()}.`, 'bot', new Date().toLocaleTimeString());
}

function setReminder(note) {
    const timeoutId = setTimeout(() => {
        displayMessage(`Nhắc nhở🕒: ${note.content}`, 'bot', new Date().toLocaleTimeString());
        notes = notes.filter(n => n !== note);
        localStorage.setItem('notes', JSON.stringify(notes));
    }, note.time - Date.now());

    noteTimeouts.push(timeoutId);
}

function handleNoteEnd() {
    displayMessage("Chức năng ghi chú đã được kết thúc.", 'bot', new Date().toLocaleTimeString());
}

function displayMessage(message, sender, timestamp) {
    const messages = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;

    const formattedMessage = encodeHTML(message).replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" style="color: navy; text-decoration: underline;">$1</a>');

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

function autoReply(message) {
    const normalizedMessage = message.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()]/g, "");
    let bestMatch = null, bestScore = 0;

    for (const question in dataMap) {
        const keywords = question.split(' ');
        const messageWords = normalizedMessage.split(' ');
        const intersection = keywords.filter(word => messageWords.includes(word)).length;
        const union = new Set([...keywords, ...messageWords]).size;
        const similarityScore = intersection / union;

        if (similarityScore > bestScore) {
            bestScore = similarityScore;
            bestMatch = dataMap[question];
        }
    }
    return bestMatch || "Xin lỗi, tôi không hiểu câu hỏi của bạn. Vui lòng liên hệ với CĐ CNTT Tp. HCM qua số hotline: 093 886 1080.";
}

document.getElementById('userInput').addEventListener('keypress', function (event) {
    if (event.key === 'Enter') {
        event.preventDefault();
        sendMessage(this.value);
        this.value = '';
    }
});

document.getElementById('userInput').addEventListener('input', function () {
    const inputValue = this.value;
    if (inputValue.length > 0) {
        displaySuggestions(inputValue);
    } else {
        document.getElementById('suggestions').innerHTML = '';
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
    loadNotes();
};

function loadNotes() {
    const storedNotes = localStorage.getItem('notes');
    if (storedNotes) {
        notes = JSON.parse(storedNotes);
        notes.forEach(note => {
            if (note.time > Date.now()) {
                setReminder(note);
            }
        });
    }
}