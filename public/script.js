document.addEventListener('DOMContentLoaded', () => {
    const locationInput = document.getElementById('locationInput');
    const identifyButton = document.getElementById('identifyButton');
    const resultDiv = document.getElementById('result');

    identifyButton.addEventListener('click', async () => {
        const inputText = locationInput.value;

        if (!inputText.trim()) {
            resultDiv.innerHTML = '<p class="error">Vui lòng nhập địa chỉ vào textbox.</p>';
            return;
        }

        try {
            const response = await fetch('/api/identify-location', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ text: inputText }) // Chỉ gửi trường 'text'
            });

            const data = await response.json();

            if (data.success && data.results.length > 0) {
                let resultHtml = ``;
                data.results.forEach(item => {
                    resultHtml += `
                        <div class="result-item">
                            <div class="info-group">
                                <strong>Phường:</strong> ${item.ward || 'Không xác định'}<br>
                                <strong>Quận:</strong> ${item.district || 'Không xác định'}<br>
                                <strong>Thành phố/Tỉnh:</strong> ${item.city || 'Không xác định'}<br>
                                <strong>Phường mới:</strong> ${item.newward || 'Không xác định'}<br>
                                <strong>Tỉnh mới:</strong> ${item.newprov || 'Không xác định'}
                            </div>
                            <button class="save-button" 
                                data-ward="${item.ward || ''}" 
                                data-district="${item.district || ''}" 
                                data-city="${item.city || ''}" 
                                data-newward="${item.newward || ''}" 
                                data-newprov="${item.newprov || ''}">Lưu</button>
                        </div>
                    `;
                });
                resultDiv.innerHTML = resultHtml;

                // Thêm trình xử lý sự kiện cho các nút "Lưu"
                document.querySelectorAll('.save-button').forEach(button => {
                    button.addEventListener('click', (event) => {
                        const savedData = {
                            ward: event.target.dataset.ward,
                            district: event.target.dataset.district,
                            city: event.target.dataset.city,
                            newward: event.target.dataset.newward,
                            newprov: event.target.dataset.newprov
                        };
                        alert('Đã lưu thông tin: ' + JSON.stringify(savedData, null, 2));
                        // Tại đây bạn có thể gửi savedData lên server hoặc lưu vào Local Storage
                        console.log('Dữ liệu đã lưu:', savedData);
                    });
                });

            } else { // Handle both success=false and success=true with no results
                resultDiv.innerHTML = `<p class="error">${data.message}</p>`;
            }
        } catch (error) {
            console.error('Lỗi khi gửi yêu cầu:', error);
            resultDiv.innerHTML = '<p class="error">Đã xảy ra lỗi khi kết nối đến server. Vui lòng kiểm tra console.</p>';
        }
    });
});