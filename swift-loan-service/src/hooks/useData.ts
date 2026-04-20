import { useState, useEffect, useCallback } from 'react';
import { Customer, LoanEntry, Settings } from '../types';
import { 
  db, auth, googleProvider, signInWithPopup, signOut, onAuthStateChanged, User 
} from '../firebase';
import { 
  doc, 
  collection, 
  onSnapshot, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  getDoc,
  writeBatch
} from 'firebase/firestore';

const STORAGE_KEYS = {
  CUSTOMERS: 'sls_customers',
  LOANS: 'sls_loans',
  SETTINGS: 'sls_settings',
};

const DEFAULT_SETTINGS: Settings = {
  interestRate: 15,
  penaltyRate: 50,
  discount: 0,
  expireDays: 30,
  method: 'flat',
  bank: 'Kasikorn Bank',
  account: '119-8383-119',
  holder: 'Mr. Sudkhet',
  pin: '123456',
  lang: 'en',
  theme: 'light',
  logoImage: 'https://i.ibb.co/v4m8vYm/logo-loan.png'
};

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We throw a serializable error message so UI can catch it or we can debug
  throw new Error(JSON.stringify(errInfo));
}

export function useData() {
  const [user, setUser] = useState<User | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loans, setLoans] = useState<LoanEntry[]>([]);
  const [settings, setSettingsState] = useState<Settings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Firestore Listeners
  useEffect(() => {
    if (!user) {
      // Fallback to local storage when offline/not logged in
      const savedCustomers = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
      const savedLoans = localStorage.getItem(STORAGE_KEYS.LOANS);
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      
      if (savedCustomers) setCustomers(JSON.parse(savedCustomers));
      if (savedLoans) setLoans(JSON.parse(savedLoans));
      if (savedSettings) setSettingsState(JSON.parse(savedSettings));
      
      return;
    }

    const userDocRef = doc(db, 'users', user.uid);
    const customersRef = collection(db, 'users', user.uid, 'customers');
    const loansRef = collection(db, 'users', user.uid, 'loans');

    // Subscribe to Settings
    const unsubSettings = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().settings) {
        setSettingsState(docSnap.data().settings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(docSnap.data().settings));
      } else {
        // Initialize user settings if not exist
        const initialSettings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || JSON.stringify(DEFAULT_SETTINGS));
        setDoc(userDocRef, { userId: user.uid, settings: initialSettings }, { merge: true })
          .catch(err => handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`));
      }
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}`));

    // Subscribe to Customers
    const unsubCustomers = onSnapshot(customersRef, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), firestoreId: d.id } as Customer & { firestoreId: string }));
      setCustomers(data);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(data));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/customers`));

    // Subscribe to Loans
    const unsubLoans = onSnapshot(loansRef, (snap) => {
      const data = snap.docs.map(d => ({ ...d.data(), firestoreId: d.id } as LoanEntry & { firestoreId: string }));
      setLoans(data);
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(data));
    }, (err) => handleFirestoreError(err, OperationType.GET, `users/${user.uid}/loans`));

    return () => {
      unsubSettings();
      unsubCustomers();
      unsubLoans();
    };
  }, [user]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      setCustomers([]);
      setLoans([]);
      setSettingsState(DEFAULT_SETTINGS);
    } catch (err) {
      console.error('Logout failed', err);
    }
  };

  const setSettings = async (newSettings: Settings) => {
    if (!user) {
      setSettingsState(newSettings);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(newSettings));
      return;
    }
    try {
      await setDoc(doc(db, 'users', user.uid), { settings: newSettings }, { merge: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}`);
    }
  };

  const addCustomer = async (customer: Omit<Customer, 'id' | 'createdAt'>) => {
    const nextId = customers.length ? Math.max(...customers.map(c => c.id)) + 1 : 1;
    const newCustomer = {
      ...customer,
      id: nextId,
      createdAt: new Date().toISOString().split('T')[0],
      createdBy: user?.uid || 'local'
    };

    if (!user) {
      const updated = [...customers, newCustomer as Customer];
      setCustomers(updated);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'customers'), newCustomer);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/customers`);
    }
  };

  const updateCustomer = async (id: number, data: Partial<Customer>) => {
    if (!user) {
      const updated = customers.map(c => c.id === id ? { ...c, ...data } : c);
      setCustomers(updated);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
      return;
    }

    const target = customers.find(c => c.id === id) as any;
    if (target?.firestoreId) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'customers', target.firestoreId), data);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/customers/${target.firestoreId}`);
      }
    }
  };

  const deleteCustomer = async (id: number) => {
    if (!user) {
      const filteredC = customers.filter(c => c.id !== id);
      const filteredL = loans.filter(l => l.customerId !== id);
      setCustomers(filteredC);
      setLoans(filteredL);
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(filteredC));
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(filteredL));
      return;
    }

    const targetCustomer = customers.find(c => c.id === id) as any;
    if (targetCustomer?.firestoreId) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'customers', targetCustomer.firestoreId));
        // Batch delete loans for this customer
        const batch = writeBatch(db);
        const relatedLoans = (loans as any[]).filter(l => l.customerId === id);
        relatedLoans.forEach(rl => {
          if (rl.firestoreId) {
            batch.delete(doc(db, 'users', user.uid, 'loans', rl.firestoreId));
          }
        });
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/customers/${targetCustomer.firestoreId}`);
      }
    }
  };

  const addLoan = async (loan: Omit<LoanEntry, 'id'>) => {
    const nextId = loans.length ? Math.max(...loans.map(l => l.id)) + 1 : 1;
    const newLoan = {
      ...loan,
      id: nextId,
      createdBy: user?.uid || 'local'
    };

    if (!user) {
      const updated = [...loans, newLoan as LoanEntry];
      setLoans(updated);
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(updated));
      return;
    }

    try {
      await addDoc(collection(db, 'users', user.uid, 'loans'), newLoan);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}/loans`);
    }
  };

  const updateLoan = async (id: number, data: Partial<LoanEntry>) => {
    if (!user) {
      const updated = loans.map(l => l.id === id ? { ...l, ...data } : l);
      setLoans(updated);
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(updated));
      return;
    }

    const target = loans.find(l => l.id === id) as any;
    if (target?.firestoreId) {
      try {
        await updateDoc(doc(db, 'users', user.uid, 'loans', target.firestoreId), data);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `users/${user.uid}/loans/${target.firestoreId}`);
      }
    }
  };

  const deleteLoan = async (id: number) => {
    if (!user) {
      const filtered = loans.filter(l => l.id !== id);
      setLoans(filtered);
      localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(filtered));
      return;
    }

    const target = loans.find(l => l.id === id) as any;
    if (target?.firestoreId) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'loans', target.firestoreId));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `users/${user.uid}/loans/${target.firestoreId}`);
      }
    }
  };

  const importData = async (data: { customers: Customer[], loans: LoanEntry[], settings: Settings }) => {
    if (!user) {
      if (data.customers) {
        setCustomers(data.customers);
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(data.customers));
      }
      if (data.loans) {
        setLoans(data.loans);
        localStorage.setItem(STORAGE_KEYS.LOANS, JSON.stringify(data.loans));
      }
      if (data.settings) {
        setSettingsState(data.settings);
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(data.settings));
      }
      return;
    }

    // Cloud import
    try {
      const batch = writeBatch(db);
      
      // Update settings
      if (data.settings) {
        batch.set(doc(db, 'users', user.uid), { settings: data.settings }, { merge: true });
      }

      // Add customers
      if (data.customers) {
        data.customers.forEach(c => {
          const cRef = doc(collection(db, 'users', user.uid, 'customers'));
          batch.set(cRef, { ...c, createdBy: user.uid });
        });
      }

      // Add loans
      if (data.loans) {
        data.loans.forEach(l => {
          const lRef = doc(collection(db, 'users', user.uid, 'loans'));
          batch.set(lRef, { ...l, createdBy: user.uid });
        });
      }

      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `users/${user.uid}/import`);
    }
  };

  return {
    user,
    isLoading,
    login,
    logout,
    customers,
    loans,
    settings,
    setSettings,
    addCustomer,
    updateCustomer,
    deleteCustomer,
    addLoan,
    updateLoan,
    deleteLoan,
    importData
  };
}
