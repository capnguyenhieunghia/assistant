let isTraCuuActive = false;

function activateTraCuu() {
    isTraCuuActive = true;
    displayMessage("Bạn muốn tra cứu đăng ký xét tuyển hay tra cứu tốt nghiệp?", 'bot');
}

function handleTraCuuResponse(response) {
    if (!isTraCuuActive) return;

    if (response.includes("đăng ký xét tuyển")) {
        displayMessage("Vui lòng nhập mSSV của bạn:", 'bot');
        document.getElementById('userInput').addEventListener('keypress', handleMSSVInput);
    } else if (response.includes("tốt nghiệp")) {
        displayMessage("Vui lòng nhập mSSV của bạn:", 'bot');
        document.getElementById('userInput').addEventListener('keypress', handleMSSVInput);
    } else {
        displayMessage("Xin lỗi, vui lòng chọn 'đăng ký xét tuyển' hoặc 'tốt nghiệp'.", 'bot');
    }
}

function handleMSSVInput(event) {
    if (event.key === 'Enter') {
        const mSSV = event.target.value;
        event.target.value = '';
        fetchStudentInfo(mSSV);
    }
}

function fetchStudentInfo(mSSV) {
    // Giả sử bạn có một API hoặc một cách nào đó để tra cứu thông tin sinh viên
    // Đây chỉ là một ví dụ đơn giản
    const studentInfo = {
        "123456": { name: "Nguyễn Văn A", status: "Đăng ký xét tuyển thành công" },
        "789012": { name: "Trần Thị B", status: "Chưa đăng ký xét tuyển" }
    };

    const info = studentInfo[mSSV];
    if (info) {
        displayMessage(`Tên: ${info.name}, Trạng thái: ${info.status}`, 'bot');
    } else {
        displayMessage("Không tìm thấy thông tin sinh viên.", 'bot');
    }
}

function startTraCuu() {
    document.getElementById('userInput').addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const message = this.value;
            console.log("Tin nhắn:", message); // In ra tin nhắn để kiểm tra
            this.value = '';
            if (message.startsWith('#tracuu')) {
                activateTraCuu();
            } else if (isTraCuuActive) {
                handleTraCuuResponse(message);
            } else {
                sendMessage(message);
            }
        }
    });
}

// Bắt đầu tính năng tra cứu
startTraCuu();