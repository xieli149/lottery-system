class LotterySystem {
    constructor() {
        this.participants = [];
        this.winners = new Set();
        this.isRunning = false;
        this.currentPrize = '';
        this.timer = null;
        this.speed = 50;

        // DOM元素
        this.lotteryBox = document.getElementById('lotteryBox');
        this.startBtn = document.getElementById('startBtn');
        this.stopBtn = document.getElementById('stopBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.participantsList = document.getElementById('participantsList');
        this.previewList = document.getElementById('previewList');
        this.resultList = document.getElementById('resultList');
        this.currentPrizeTitle = document.getElementById('currentPrizeTitle');
        this.newName = document.getElementById('newName');
        this.avatarInput = document.getElementById('avatarInput');
        this.addParticipantBtn = document.getElementById('addParticipant');
        this.winnerAvatar = document.getElementById('winnerAvatar');
        this.csvInput = document.getElementById('csvInput');
        this.zipInput = document.getElementById('zipInput');
        this.clearAllBtn = document.getElementById('clearAllBtn');
        this.totalCount = document.getElementById('totalCount');
        this.loadingOverlay = document.querySelector('.loading-overlay');
        
        // 绑定事件
        this.startBtn.addEventListener('click', () => this.startLottery());
        this.stopBtn.addEventListener('click', () => this.stopLottery());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.addParticipantBtn.addEventListener('click', () => this.addParticipant());
        this.avatarInput.addEventListener('change', () => this.handleAvatarSelect());
        this.csvInput.addEventListener('change', (e) => this.handleCsvImport(e));
        this.zipInput.addEventListener('change', (e) => this.handleZipImport(e));
        this.clearAllBtn.addEventListener('click', () => this.clearAll());

        // 加载保存的参与者数据
        this.loadParticipants();
    }

    // 显示加载动画
    showLoading() {
        this.loadingOverlay.style.display = 'flex';
    }

    // 隐藏加载动画
    hideLoading() {
        this.loadingOverlay.style.display = 'none';
    }

    // 处理CSV/Excel文件导入
    async handleCsvImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading();
        try {
            let names = [];
            
            if (file.name.endsWith('.csv')) {
                // 尝试多种编码方式读取CSV
                try {
                    // 首先尝试 UTF-8
                    const text = await file.text();
                    names = this.parseCSVContent(text);
                } catch (e) {
                    // 如果UTF-8失败，尝试其他编码
                    const arrayBuffer = await file.arrayBuffer();
                    // 尝试 GB2312
                    const decoder = new TextDecoder('gb2312');
                    const text = decoder.decode(arrayBuffer);
                    names = this.parseCSVContent(text);
                }
            } else {
                // 处理Excel文件
                const arrayBuffer = await file.arrayBuffer();
                const workbook = XLSX.read(arrayBuffer);
                names = this.extractNamesFromWorkbook(workbook);
            }

            if (names.length === 0) {
                throw new Error('未找到有效的姓名数据');
            }
            
            // 生成随机头像颜色
            const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD', '#D4A5A5', '#9B59B6', '#3498DB'];
            let importCount = 0;
            let duplicateCount = 0;
            
            // 添加参与者（使用带有随机颜色的头像）
            names.forEach(name => {
                if (!name) return; // 跳过空名字
                
                if (this.participants.some(p => p.name === name)) {
                    duplicateCount++;
                    return;
                }

                // 为每个人生成一个带有首字母的彩色头像
                const canvas = document.createElement('canvas');
                canvas.width = 100;
                canvas.height = 100;
                const ctx = canvas.getContext('2d');
                
                // 随机选择背景色
                const bgColor = colors[Math.floor(Math.random() * colors.length)];
                
                // 绘制圆形背景
                ctx.fillStyle = bgColor;
                ctx.beginPath();
                ctx.arc(50, 50, 50, 0, Math.PI * 2);
                ctx.fill();
                
                // 绘制文字
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 40px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const initial = name.charAt(0);
                ctx.fillText(initial, 50, 50);
                
                // 将canvas转换为base64图片
                const avatar = canvas.toDataURL('image/png');
                
                this.participants.push({
                    name,
                    avatar
                });
                importCount++;
            });

            this.saveParticipants();
            this.updateParticipantsList();
            this.csvInput.value = '';
            
            // 显示导入结果消息
            let message = `成功导入 ${importCount} 个参与者`;
            if (duplicateCount > 0) {
                message += `\n${duplicateCount} 个重复名字已自动跳过`;
            }
            alert(message);
        } catch (error) {
            console.error('导入错误:', error);
            alert('导入失败：' + error.message + '\n请确保文件格式正确，并使用UTF-8编码保存');
        } finally {
            this.hideLoading();
        }
    }

    // 解析CSV内容
    parseCSVContent(text) {
        return text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0 && line !== '姓名' && line !== ',')  // 排除标题行和空行
            .map(line => {
                // 处理可能的CSV格式（包含逗号的情况）
                const parts = line.split(',');
                return parts[0].trim();  // 取第一列作为姓名
            })
            .filter(name => name.length > 0);  // 过滤掉空名字
    }

    // 处理ZIP文件导入
    async handleZipImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.showLoading();
        try {
            const zipData = await file.arrayBuffer();
            const zip = await JSZip.loadAsync(zipData);
            const nameFile = Object.values(zip.files).find(f => f.name.endsWith('names.txt'));
            
            if (!nameFile) {
                throw new Error('未找到names.txt文件');
            }

            const namesText = await nameFile.async('text');
            const names = namesText.split('\n').map(n => n.trim()).filter(n => n);

            // 处理每个人的头像
            for (const name of names) {
                const avatarFile = Object.values(zip.files).find(f => 
                    f.name.toLowerCase().startsWith(name.toLowerCase()) && 
                    (f.name.endsWith('.jpg') || f.name.endsWith('.png'))
                );

                let avatar = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
                
                if (avatarFile) {
                    const avatarData = await avatarFile.async('base64');
                    const extension = avatarFile.name.split('.').pop().toLowerCase();
                    avatar = `data:image/${extension};base64,${avatarData}`;
                }

                if (!this.participants.some(p => p.name === name)) {
                    this.participants.push({ name, avatar });
                }
            }

            this.saveParticipants();
            this.updateParticipantsList();
            this.zipInput.value = '';
        } catch (error) {
            alert('导入失败：' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    // 读取Excel文件
    async readExcelFile(arrayBuffer, fileName) {
        if (fileName.endsWith('.csv')) {
            const text = new TextDecoder().decode(arrayBuffer);
            const rows = text.split('\n').map(row => row.split(','));
            return { SheetNames: ['Sheet1'], Sheets: { 'Sheet1': rows } };
        } else {
            return XLSX.read(arrayBuffer);
        }
    }

    // 从工作簿中提取名字
    extractNamesFromWorkbook(workbook) {
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
        return data.flat().map(name => String(name).trim()).filter(name => name);
    }

    // 清空所有参与者
    clearAll() {
        if (confirm('确定要清空所有参与者吗？')) {
            this.participants = [];
            this.saveParticipants();
            this.updateParticipantsList();
        }
    }

    // 处理头像选择
    handleAvatarSelect() {
        const file = this.avatarInput.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.currentAvatar = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    // 添加参与者
    addParticipant() {
        const name = this.newName.value.trim();
        if (!name) {
            alert('请输入姓名！');
            return;
        }

        const avatar = this.currentAvatar || 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        
        const participant = { name, avatar };
        this.participants.push(participant);
        this.saveParticipants();
        this.updateParticipantsList();
        
        // 清空输入
        this.newName.value = '';
        this.avatarInput.value = '';
        this.currentAvatar = null;
    }

    // 移除参与者
    removeParticipant(index) {
        this.participants.splice(index, 1);
        this.saveParticipants();
        this.updateParticipantsList();
    }

    // 更新参与者列表显示
    updateParticipantsList() {
        this.participantsList.innerHTML = '';
        this.previewList.innerHTML = '';
        this.totalCount.textContent = this.participants.length;
        
        this.participants.forEach((participant, index) => {
            const item = document.createElement('div');
            item.className = 'participant-item';
            item.innerHTML = `
                <img src="${participant.avatar}" alt="${participant.name}">
                <span>${participant.name}</span>
                <button class="remove-btn">删除</button>
            `;
            
            item.querySelector('.remove-btn').addEventListener('click', () => this.removeParticipant(index));
            this.previewList.appendChild(item);
        });

        this.currentPrizeTitle.textContent = `总共 ${this.participants.length} 人参与抽奖`;
    }

    // 保存参与者数据到本地存储
    saveParticipants() {
        localStorage.setItem('lotteryParticipants', JSON.stringify(this.participants));
    }

    // 从本地存储加载参与者数据
    loadParticipants() {
        const saved = localStorage.getItem('lotteryParticipants');
        if (saved) {
            this.participants = JSON.parse(saved);
            this.updateParticipantsList();
        }
    }

    getRandomPerson() {
        const availablePeople = this.participants.filter(p => !this.winners.has(p.name));
        if (availablePeople.length === 0) return null;
        return availablePeople[Math.floor(Math.random() * availablePeople.length)];
    }

    updatePrizeStyle() {
        this.lotteryBox.classList.remove('first-prize', 'second-prize', 'third-prize');
        this.lotteryBox.classList.add(`${this.currentPrize.split('等')[0]}-prize`);
    }

    startLottery() {
        if (this.participants.length === 0) {
            alert('请先添加参与者！');
            return;
        }

        const firstPrize = document.getElementById('firstPrize').value;
        const secondPrize = document.getElementById('secondPrize').value;
        const thirdPrize = document.getElementById('thirdPrize').value;

        const remainingPeople = this.participants.length - this.winners.size;
        const totalPrizes = parseInt(firstPrize) + parseInt(secondPrize) + parseInt(thirdPrize);

        if (totalPrizes > remainingPeople) {
            alert('奖项数量超过剩余参与人数！');
            return;
        }

        this.isRunning = true;
        this.startBtn.disabled = true;
        this.stopBtn.disabled = false;
        this.addParticipantBtn.disabled = true;

        // 确定当前抽取的奖项
        if (this.winners.size < firstPrize) {
            this.currentPrize = '一等奖';
        } else if (this.winners.size < parseInt(firstPrize) + parseInt(secondPrize)) {
            this.currentPrize = '二等奖';
        } else {
            this.currentPrize = '三等奖';
        }

        // 更新UI显示
        this.currentPrizeTitle.textContent = `正在抽取${this.currentPrize}`;
        this.updatePrizeStyle();
        this.roll();
    }

    roll() {
        if (!this.isRunning) return;
        
        const winner = this.getRandomPerson();
        if (winner) {
            const winnerElement = this.lotteryBox.querySelector('.winner-name');
            winnerElement.textContent = winner.name;
            winnerElement.classList.remove('highlight');
            this.winnerAvatar.src = winner.avatar;
            this.winnerAvatar.classList.remove('highlight');
        }
        
        this.timer = setTimeout(() => this.roll(), this.speed);
    }

    stopLottery() {
        this.isRunning = false;
        clearTimeout(this.timer);
        
        const winnerName = this.lotteryBox.querySelector('.winner-name').textContent;
        const winner = this.participants.find(p => p.name === winnerName);
        
        if (winner) {
            this.winners.add(winner.name);
            // 添加中奖动画效果
            const winnerElement = this.lotteryBox.querySelector('.winner-name');
            winnerElement.classList.add('highlight');
            this.winnerAvatar.classList.add('highlight');
            this.addToResultList(winner);
        }

        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.addParticipantBtn.disabled = false;

        // 检查是否还能继续抽奖
        const firstPrize = document.getElementById('firstPrize').value;
        const secondPrize = document.getElementById('secondPrize').value;
        const thirdPrize = document.getElementById('thirdPrize').value;
        const totalPrizes = parseInt(firstPrize) + parseInt(secondPrize) + parseInt(thirdPrize);

        if (this.winners.size >= totalPrizes) {
            this.startBtn.disabled = true;
            this.currentPrizeTitle.textContent = '抽奖完成！';
            this.lotteryBox.querySelector('.winner-name').textContent = '抽奖结束';
        }
    }

    addToResultList(winner) {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${this.currentPrize.split('等')[0]}-prize`;
        resultItem.innerHTML = `
            <img src="${winner.avatar}" alt="${winner.name}">
            <span>${this.currentPrize}：${winner.name}</span>
        `;
        
        // 添加动画效果
        resultItem.style.opacity = '0';
        resultItem.style.transform = 'translateY(20px)';
        this.resultList.insertBefore(resultItem, this.resultList.firstChild);
        
        // 触发动画
        setTimeout(() => {
            resultItem.style.opacity = '1';
            resultItem.style.transform = 'translateY(0)';
        }, 50);
    }

    reset() {
        this.winners.clear();
        this.isRunning = false;
        clearTimeout(this.timer);
        this.currentPrizeTitle.textContent = '准备开始抽奖';
        this.lotteryBox.querySelector('.winner-name').textContent = '准备开始';
        this.winnerAvatar.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
        this.resultList.innerHTML = '';
        this.startBtn.disabled = false;
        this.stopBtn.disabled = true;
        this.addParticipantBtn.disabled = false;
        this.lotteryBox.classList.remove('first-prize', 'second-prize', 'third-prize');
        this.updateParticipantsList();
    }
}

// 初始化抽奖系统
document.addEventListener('DOMContentLoaded', async () => {
    // 动态加载所需的库
    await Promise.all([
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'),
        loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js')
    ]);
    new LotterySystem();
});

// 动态加载脚本
function loadScript(src) {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = src;
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
    });
} 