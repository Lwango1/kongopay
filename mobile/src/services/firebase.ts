import { initializeApp } from '@react-native-firebase/app';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCgIZMG7n0feKatCNr_b1plf4tOzzKHnac',
  authDomain: 'kongopay-19815.firebaseapp.com',
  projectId: 'kongopay-19815',
  storageBucket: 'kongopay-19815.firebasestorage.app',
  messagingSenderId: '1043431316190',
  appId: '1:1043431316190:web:ae101c7c8169516b39c04f',
};

const app = initializeApp(firebaseConfig);

export { app, auth, firestore };
