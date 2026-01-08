importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// 1. Remets ta config Firebase ici (la même que dans index.html)
const firebaseConfig = {
    apiKey: "AIzaSyA7ZNlC1ILS9-W3bgxWogUA6ak4c29a4Ns",
    authDomain: "lovetravel-35285.firebaseapp.com",
    projectId: "lovetravel-35285",
    storageBucket: "lovetravel-35285.firebasestorage.app",
    messagingSenderId: "189902268760",
    appId: "1:189902268760:web:b461ce15d8c396be479d2d"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 2. Ce qui se passe quand le téléphone reçoit le message en arrière-plan
messaging.onBackgroundMessage((payload) => {
  console.log('Message reçu en background:', payload);
  
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'https://cdn-icons-png.flaticon.com/512/2530/2530860.png', // Ton icône
    vibrate: [200, 100, 200, 100, 400], // Vibration (Marche sur Android, iPhone fait sa vibration standard)
    tag: 'bisou-notif'
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});
