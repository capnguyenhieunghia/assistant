function findSimilarQuestion(input) {
    const normalizedInput = input.toLowerCase().replace(/[.,/#!$%^&*;:{}=-_`~()]/g, "");
    let bestMatch = null, bestScore = 0;

    for (const question in dataMap) {
        const score = calculateSimilarity(normalizedInput, question);
        if (score > bestScore) {
            bestScore = score;
            bestMatch = question;
        }
    }

    return bestMatch;
}

function calculateSimilarity(input, question) {
    const inputWords = input.split(' ');
    const questionWords = question.split(' ');
    const intersection = inputWords.filter(word => questionWords.includes(word)).length;
    const union = new Set([...inputWords, ...questionWords]).size;

    return intersection / union;
}
function processResponse(message) {
    const response = autoReply(message);
    if (response.startsWith("Xin lỗi")) {
        checkAndAddNewQuestion(message, response);
    }
    return response;
}
function suggestResponses(input) {
    const suggestions = suggestionsList.filter(suggestion =>
        suggestion.toLowerCase().includes(input.toLowerCase())
    );
    return suggestions;
}
function rememberChatHistory() {
    const chatHistory = document.getElementById('messages').innerHTML;
    setCookie('chatHistory', chatHistory, 7);
}

function loadChatHistory() {
    const chatHistory = getCookie('chatHistory');
    if (chatHistory) {
        document.getElementById('messages').innerHTML = chatHistory;
        scrollToBottom();
    }
}

function scrollToBottom() {
    const messages = document.getElementById('messages');
    messages.scrollTop = messages.scrollHeight;
}
function evaluateResponseAccuracy(userInput, botResponse) {
    const expectedResponse = dataMap[findSimilarQuestion(userInput)];
    return expectedResponse === botResponse;
}

// document.addEventListener('contextmenu', function (e) {
//     e.preventDefault();
// });
// document.onkeydown = function (e) {
//     if (e.keyCode === 123) {
//         return false;
//     }
//     if (e.ctrlKey && (e.keyCode === 67 || e.keyCode === 86 || e.keyCode === 85)) { 
//         return false;
//     }
// };
// setInterval(function () {
//     if (window.devtools && window.devtools.open) {
//         alert('DevTools is open!');
//     }
// }, 1000);

