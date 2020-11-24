// Connect to socket server
const socket = io();

socket.on('server-send', (msg) => {
    console.log(msg);
    socket.emit('client-send', 'client')
});

// Catch event of button Join Meeting from client
const joinMeeting = document.getElementById('join_meeting');

joinMeeting.onclick = function () {
    // Get userName and speechLanguage to send to server
    const userName = document.getElementById('display_name').value;
    console.log(`User name: ${userName}`)
    const speechLanguage = document.getElementById('meeting_lang').selectedOptions[0].value;
    console.log(`User spech language: ${speechLanguage}`)
    
    socket.emit('user-data', {
        'userName': userName,
        'lang': speechLanguage
    })
}
