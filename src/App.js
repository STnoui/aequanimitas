import React, { useState, useEffect, useCallback, useMemo, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, addDoc, query, where, onSnapshot, doc, setDoc, getDoc, Timestamp, orderBy as firestoreOrderBy, serverTimestamp, deleteDoc, runTransaction, writeBatch, getDocs } from 'firebase/firestore';
import { motion, AnimatePresence } from 'framer-motion';
import { Home, BookOpen, Brain, Settings, User, Feather, Edit3, Trash2, CheckCircle, XCircle, ChevronLeft, ChevronRight, ChevronDown, Plus, Sun, Moon, Palette, Smile, TrendingUp, BarChart3, CalendarDays, Search, Filter, Layers, Sparkles, Info, FileText, Users, ShieldCheck, Target, AlertTriangle, MessageSquare, ThumbsUp, ThumbsDown, Star, ListChecks, HelpCircle, Zap, Lightbulb, LogIn, BookHeart, Award } from 'lucide-react';

// --- Constants & Initial Data ---
const APP_NAME = "Aequanimitas";
const APP_VERSION = "4.5.1"; // Version Update for z-index fix

// --- Firebase Configuration ---
// Note: These variables would normally be injected at build time or from environment variables
const firebaseConfig = (typeof window !== 'undefined' && window.__firebase_config) ? JSON.parse(window.__firebase_config) : {
    apiKey: "YOUR_FALLBACK_API_KEY",
    authDomain: "YOUR_FALLBACK_AUTH_DOMAIN",
    projectId: "YOUR_FALLBACK_PROJECT_ID",
    storageBucket: "YOUR_FALLBACK_STORAGE_BUCKET",
    messagingSenderId: "YOUR_FALLBACK_MESSAGING_SENDER_ID",
    appId: "YOUR_FALLBACK_APP_ID"
};
const appId = (typeof window !== 'undefined' && window.__app_id) ? window.__app_id : 'aequanimitas-v4.5.1-fix';

// --- Initialize Firebase ---
let app;
let auth;
let db;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("Error initializing Firebase:", error);
}

// --- Theming ---
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
    const [mode, setMode] = useState('system'); 
    const [effectiveDarkMode, setEffectiveDarkMode] = useState(true);

    useEffect(() => {
        const storedMode = localStorage.getItem(`${appId}-mode`) || 'system';
        setMode(storedMode);
    }, []);
    
    useEffect(() => {
        const applyMode = (currentMode) => {
            let newEffectiveDarkMode;
            if (currentMode === 'dark') {
                newEffectiveDarkMode = true;
            } else if (currentMode === 'light') {
                newEffectiveDarkMode = false;
            } else { 
                newEffectiveDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            }
            setEffectiveDarkMode(newEffectiveDarkMode);
            document.documentElement.classList.toggle('dark', newEffectiveDarkMode);
        };

        applyMode(mode); 

        localStorage.setItem(`${appId}-mode`, mode);

        if (mode === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handleChange = () => applyMode('system');
            mediaQuery.addEventListener('change', handleChange);
            return () => mediaQuery.removeEventListener('change', handleChange);
        }
    }, [mode]);

    const changeMode = (newMode) => setMode(newMode);
    
    const interactiveColor = effectiveDarkMode ? 'text-gray-200' : 'text-gray-800';
    const interactiveHoverBg = effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-200';
    const interactiveRing = effectiveDarkMode ? 'focus:ring-gray-500' : 'focus:ring-gray-400';

    return (
        <ThemeContext.Provider value={{ mode, changeMode, effectiveDarkMode, interactiveColor, interactiveHoverBg, interactiveRing }}>
            {children}
        </ThemeContext.Provider>
    );
};
const useTheme = () => useContext(ThemeContext);

// --- Global Modal Context ---
const ModalContext = createContext();

const ModalProvider = ({ children }) => {
    const [modalState, setModalState] = useState({ isOpen: false, type: 'alert', title: '', message: '', onConfirm: null, confirmText: 'OK', cancelText: 'Cancel' });
    const { effectiveDarkMode } = useTheme();

    const showAlert = (title, message) => {
        setModalState({ isOpen: true, type: 'alert', title, message, onConfirm: null, confirmText: 'OK' });
    };

    const showConfirm = (title, message, onConfirmCallback, confirmText = 'Confirm', cancelText = 'Cancel') => {
        setModalState({ isOpen: true, type: 'confirm', title, message, onConfirm: onConfirmCallback, confirmText, cancelText });
    };

    const closeModal = () => {
        setModalState(prev => ({ ...prev, isOpen: false }));
    };

    const handleConfirm = () => {
        if (modalState.onConfirm) {
            modalState.onConfirm();
        }
        closeModal();
    };

    return (
        <ModalContext.Provider value={{ showAlert, showConfirm }}>
            {children}
            <AnimatePresence>
                {modalState.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-[100]"
                        onClick={modalState.type === 'alert' ? handleConfirm : closeModal}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                            className={`rounded-xl shadow-2xl w-full max-w-xs p-5
                                        ${effectiveDarkMode ? 'bg-gray-800 text-gray-100 border border-gray-700' : 'bg-white text-gray-900 border border-gray-200'}`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-start mb-3">
                                {modalState.type === 'confirm' && <AlertTriangle size={22} className={`mr-2 mt-0.5 ${effectiveDarkMode ? 'text-yellow-400' : 'text-yellow-500'} flex-shrink-0`} />}
                                <h3 className={`text-lg font-semibold ${effectiveDarkMode ? 'text-white' : 'text-gray-800'}`}>{modalState.title}</h3>
                            </div>
                            <p className={`text-sm mb-5 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{modalState.message}</p>
                            <div className={`flex ${modalState.type === 'alert' ? 'justify-end' : 'justify-between'} space-x-3`}>
                                {modalState.type === 'confirm' && (
                                    <StyledButton onClick={closeModal} variant="secondary" small>
                                        {modalState.cancelText}
                                    </StyledButton>
                                )}
                                <StyledButton onClick={handleConfirm} variant={modalState.confirmText.toLowerCase().includes('delete') ? 'danger' : 'primary'} small >
                                    {modalState.confirmText}
                                </StyledButton>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </ModalContext.Provider>
    );
};
const useModal = () => useContext(ModalContext);


// --- Stoic Data ---
const stoicPhilosophers = { 
    epictetus: { name: "Epictetus", era: "c. 50 – c. 135 AD", school: "Stoicism (Roman)", keyWorks: ["Discourses", "Enchiridion"], bio: "Born a slave, Epictetus became a renowned Stoic philosopher, emphasizing ethics, self-control, and the distinction between what we can and cannot control. His teachings profoundly influenced Marcus Aurelius.", summary: "Focused on inner freedom through distinguishing what's in our control." },
    marcus_aurelius: { name: "Marcus Aurelius", era: "121 – 180 AD", school: "Stoicism (Roman Emperor)", keyWorks: ["Meditations"], bio: "Roman Emperor and Stoic philosopher, Marcus Aurelius wrote 'Meditations' as a personal journal of reflections on Stoic principles, focusing on duty, reason, and acceptance of fate.", summary: "Emphasized duty, reason, and acceptance from the perspective of a ruler." },
    seneca: { name: "Seneca the Younger", era: "c. 4 BC – AD 65", school: "Stoicism (Roman)", keyWorks: ["Letters from a Stoic", "On the Shortness of Life", "On Anger"], bio: "A statesman, dramatist, and philosopher, Seneca explored themes of virtue, emotional regulation, and practical wisdom in his influential writings. He served as an advisor to Emperor Nero.", summary: "Wrote extensively on practical ethics, managing emotions, and the brevity of life." },
    zeno: { name: "Zeno of Citium", era: "c. 334 – c. 262 BC", school: "Stoicism (Founder)", keyWorks: ["Republic (lost)"], bio: "The founder of Stoicism, Zeno taught that virtue, the only good, is based on knowledge, and that wisdom lies in living in accordance with nature and reason.", summary: "Laid the foundational principles of Stoic philosophy." },
    musonius_rufus: { name: "Musonius Rufus", era: "c. 30 – c. 100 AD", school: "Stoicism (Roman)", keyWorks: ["Lectures (recorded by Lucius)"], bio: "Called the 'Roman Socrates,' Musonius Rufus was a Stoic philosopher who taught Epictetus. He emphasized practical ethics and believed philosophy should be lived, not just studied. Advocated for equality of sexes in education.", summary: "Championed practical application of Stoicism and equality."}
};
const stoicQuotes = [ 
    { id: "e1", quote: "The chief task in life is simply this: to identify and separate matters so that I can say clearly to myself which are externals not under my control, and which have to do with the choices I actually control.", author: "epictetus", tags: ["control", "choice", "externals", "discernment"] },
    { id: "e2", quote: "First say to yourself what you would be; and then do what you have to do.", author: "epictetus", tags: ["identity", "action", "purpose", "intention"] },
    { id: "e3", quote: "It's not what happens to you, but how you react to it that matters.", author: "epictetus", tags: ["reaction", "perception", "resilience"] },
    { id: "m1", quote: "Waste no more time arguing about what a good man should be. Be one.", author: "marcus_aurelius", tags: ["action", "virtue", "character", "integrity"] },
    { id: "m2", quote: "If you are distressed by anything external, the pain is not due to the thing itself, but to your estimate of it; and this you have the power to revoke at any moment.", author: "marcus_aurelius", tags: ["perception", "control", "emotion", "suffering", "mindset"] },
    { id: "m3", quote: "You have power over your mind – not outside events. Realize this, and you will find strength.", author: "marcus_aurelius", tags: ["control", "mind", "strength", "resilience", "inner_power"] },
    { id: "m4", quote: "The happiness of your life depends upon the quality of your thoughts.", author: "marcus_aurelius", tags: ["happiness", "thoughts", "mindset", "wellbeing", "cognition"] },
    { id: "s1", quote: "Difficulties strengthen the mind, as labor does the body.", author: "seneca", tags: ["resilience", "challenge", "growth", "strength", "adversity"] },
    { id: "s2", quote: "It is not the man who has too little, but the man who craves more, that is poor.", author: "seneca", tags: ["desire", "contentment", "wealth", "perspective", "minimalism"] },
    { id: "s3", quote: "Luck is what happens when preparation meets opportunity.", author: "seneca", tags: ["luck", "preparation", "opportunity", "proactivity"] },
    { id: "z1", quote: "Man conquers the world by conquering himself.", author: "zeno", tags: ["self-mastery", "control", "inner_strength", "discipline"] },
    { id: "mr1", quote: "We will train both soul and body when we accustom ourselves to cold, heat, thirst, hunger, scarcity of food, hardness of bed, abstaining from pleasures, and enduring pains.", author: "musonius_rufus", tags: ["discipline", "asceticism", "resilience", "training"] }
];
const stoicTenets = { 
    dichotomy_of_control: { title: "Dichotomy of Control", summary: "Focus on what you can control and accept what you cannot.", icon: Layers, explanation: "This principle, central to Stoicism, divides all things into two categories: those within our complete control (our judgments, impulses, desires, aversions) and those not (our body, property, reputation, external events). True tranquility comes from focusing our energy solely on the former and accepting the latter with equanimity." },
    virtue_ethics: { title: "Virtue as the Sole Good", summary: "Virtue (wisdom, justice, courage, temperance) is the only true good.", icon: ShieldCheck, explanation: "For Stoics, happiness (eudaimonia) is achieved by living a virtuous life. Wisdom allows us to discern correctly, Justice to act fairly, Courage to face adversity, and Temperance to moderate desires. External 'goods' or 'bads' are considered 'indifferents' – they don't determine our moral worth or true happiness." },
    live_according_to_nature: { title: "Live According to Nature", summary: "Live in accordance with reason and the rational order of the cosmos.", icon: Sparkles, explanation: "Stoics believed the universe is governed by reason (Logos). To live according to nature means to use our own capacity for reason to understand this order and our role within it. This includes fulfilling our duties to society and acting in harmony with others." },
    premeditatio_malorum: { title: "Premeditation of Evils", summary: "Contemplate potential misfortunes to reduce their impact and appreciate the present.", icon: CalendarDays, explanation: "This isn't about pessimistic worrying, but a rational exercise. By mentally rehearsing potential setbacks (loss, illness, hardship), we diminish their shock value and prepare ourselves to respond virtuously if they happen. It also cultivates gratitude for what we currently have." },
    amor_fati: { title: "Amor Fati (Love of Fate)", summary: "Accept and embrace everything that happens as part of the natural order.", icon: Sun, explanation: "A more advanced Stoic concept, Amor Fati encourages not just acceptance but a welcoming of all experiences as necessary parts of the whole. It's about finding meaning and purpose even in adversity, trusting the rationality of the cosmos." },
    social_duty: { title: "Cosmopolitanism & Social Duty", summary: "View all humans as citizens of the cosmos; serve humanity.", icon: Users, explanation: "Stoics believed in a universal brotherhood. Our reason connects us to all other rational beings. This leads to an emphasis on justice, fairness, and contributing to the common good. We have duties to our family, community, and humanity as a whole."}
};

// --- Animation Variants ---
const onboardingPageVariants = { 
    initial: { opacity: 0, y: 30 },
    in: { opacity: 1, y: 0 },
    out: { opacity: 0, y: -30 } 
};
const onboardingPageTransition = { type: 'tween', ease: 'circOut', duration: 0.6 }; 

const pageVariants = { 
    initial: { opacity: 0.8 }, 
    in: { opacity: 1 },
    out: { opacity: 0.8 }
};
const pageTransition = { type: 'tween', ease: 'circOut', duration: 0.25 };

const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: (i = 0) => ({
        opacity: 1,
        y: 0,
        transition: { delay: i * 0.05, type: 'spring', stiffness: 100, damping: 12 }
    })
};

// --- Reusable UI Components ---
const AnimatedCard = ({ children, className = "", onClick, custom, noPadding = false, ...props }) => {
    const { effectiveDarkMode } = useTheme();
    return (
        <motion.div
            variants={itemVariants}
            custom={custom}
            onClick={onClick}
            className={`rounded-xl shadow-lg transition-colors duration-300
                        ${effectiveDarkMode ? 'bg-gray-800/60 hover:bg-gray-700/70 border border-gray-700/50' 
                                  : 'bg-white/60 hover:bg-gray-50/70 border border-gray-200/50'}
                        ${onClick ? 'cursor-pointer' : ''}
                        backdrop-blur-md 
                        ${noPadding ? '' : 'p-3.5'} 
                        ${className}`}
            {...props}
        >
            {children}
        </motion.div>
    );
};

const FAB = ({ onClick, icon: Icon, label }) => {
    const { effectiveDarkMode } = useTheme();
    return (
        <motion.button
            onClick={onClick}
            className={`fixed bottom-24 right-5 md:bottom-6 md:right-6 z-30 p-3.5 rounded-full shadow-xl flex items-center justify-center
                        ${effectiveDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-100' : 'bg-gray-800 hover:bg-gray-700 text-white'}
                        transition-all duration-200 transform hover:scale-105`}
            aria-label={label}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
        >
            <Icon size={24} />
        </motion.button>
    );
};

const StyledModal = ({ isOpen, onClose, title, children, size = "md" }) => {
    const { effectiveDarkMode, interactiveColor } = useTheme();
    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-sm', md: 'max-w-md', lg: 'max-w-lg', xl: 'max-w-xl'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 10 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 10 }}
                        transition={{ type: 'spring', stiffness: 250, damping: 25 }}
                        className={`rounded-xl shadow-xl w-full ${sizeClasses[size]} 
                                    ${effectiveDarkMode ? 'bg-gray-800 text-gray-100 border border-gray-700' : 'bg-white text-gray-900 border border-gray-200'}`}
                        onClick={(e) => e.stopPropagation()} 
                    >
                        <div className={`flex justify-between items-center p-3.5 border-b ${effectiveDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                            <h2 className={`text-lg font-semibold ${interactiveColor}`}>{title}</h2>
                            <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClose}
                                className={`p-1 rounded-full ${effectiveDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-200'}`}>
                                <XCircle size={24} className={effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'} />
                            </motion.button>
                        </div>
                        <div className="p-3.5 max-h-[70vh] overflow-y-auto">
                            {children}
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

const StyledButton = ({ onClick, children, variant = "primary", className = "", icon: Icon, type = "button", fullWidth = false, small = false, isLoading = false, disabled = false }) => {
    const { effectiveDarkMode, interactiveRing } = useTheme();
    let baseStyle = `${small ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm'} rounded-lg font-medium focus:outline-none ${interactiveRing} focus:ring-2 transition-all duration-150 ease-in-out flex items-center justify-center space-x-1.5 shadow-sm hover:shadow-md`;
    if (fullWidth) baseStyle += " w-full";
    if (isLoading || disabled) baseStyle += " opacity-50 cursor-not-allowed";

    let variantStyle = "";
    if (variant === "primary") {
        variantStyle = `${effectiveDarkMode ? 'bg-gray-200 text-gray-900 hover:bg-gray-300' : 'bg-gray-800 text-white hover:bg-gray-700'}`;
    } else if (variant === "secondary") {
        variantStyle = `${effectiveDarkMode ? 'bg-gray-700 hover:bg-gray-600 text-gray-200' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'}`;
    } else if (variant === "danger") {
        variantStyle = `bg-red-600 hover:bg-red-700 text-white focus:ring-red-500/50`;
    } else if (variant === "ghost") {
         variantStyle = `${effectiveDarkMode ? 'text-gray-400 hover:bg-gray-700/70 hover:text-gray-200' : 'text-gray-500 hover:bg-gray-100/70 hover:text-gray-700'} shadow-none hover:shadow-none`;
    } else if (variant === "ai") { 
        variantStyle = `${effectiveDarkMode ? 'bg-gray-600 hover:bg-gray-500 text-gray-100' : 'bg-gray-300 hover:bg-gray-400 text-gray-800'}`;
    }

    return (
        <motion.button
            type={type}
            onClick={onClick}
            className={`${baseStyle} ${variantStyle} ${className}`}
            whileTap={{ scale: (isLoading || disabled) ? 1 : 0.97 }}
            disabled={isLoading || disabled}
        >
            {isLoading ? (
                <motion.div className={`w-3.5 h-3.5 border-2 ${effectiveDarkMode ? 'border-gray-400' : 'border-gray-600'} border-t-transparent rounded-full animate-spin`} />
            ) : (
                Icon && <Icon size={small ? 14 : 16} />
            )}
            <span>{children}</span>
        </motion.button>
    );
};

// --- User Context & Personalization ---
const UserContext = createContext();

const UserProvider = ({ children }) => {
    const [userId, setUserId] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userPreferences, setUserPreferences] = useState(null);
    const [isLoadingPreferences, setIsLoadingPreferences] = useState(true);
    const [journalStats, setJournalStats] = useState({ count: 0, streak: 0, commonMoods: [] });
    const [justCompletedOnboarding, setJustCompletedOnboarding] = useState(false);


    useEffect(() => {
        if (!auth) {
            setIsAuthReady(true); setIsLoadingPreferences(false); return;
        }
        const unsubAuth = onAuthStateChanged(auth, async (user) => {
            if (user) setUserId(user.uid);
            else {
                try {
                    if (typeof window !== 'undefined' && window.__initial_auth_token) await signInWithCustomToken(auth, window.__initial_auth_token);
                    else await signInAnonymously(auth);
                } catch (error) { console.error("Error signing in:", error); }
            }
            setIsAuthReady(true);
        });
        return () => unsubAuth();
    }, []);

    useEffect(() => {
        if (userId && db) {
            setIsLoadingPreferences(true);
            const prefPath = `artifacts/${appId}/users/${userId}/preferences/main`;
            const unsubPrefs = onSnapshot(doc(db, prefPath), (docSnap) => {
                const prefsData = docSnap.exists() ? docSnap.data() : null;
                if (userPreferences && !userPreferences.completedOnboarding && prefsData && prefsData.completedOnboarding) {
                    setJustCompletedOnboarding(true);
                }
                setUserPreferences(prefsData);
                setIsLoadingPreferences(false);
            }, (error) => { console.error("Error fetching preferences:", error); setIsLoadingPreferences(false); });

            const journalPath = `artifacts/${appId}/users/${userId}/journalEntries`;
            const q = query(collection(db, journalPath), firestoreOrderBy("createdAt", "desc"));
            const unsubJournal = onSnapshot(q, (snapshot) => {
                const entries = snapshot.docs.map(d => ({id: d.id, ...d.data()}));
                const moods = entries.map(e => e.mood).filter(Boolean);
                const moodCounts = moods.reduce((acc, mood) => { acc[mood] = (acc[mood] || 0) + 1; return acc; }, {});
                const commonMoods = Object.entries(moodCounts).sort((a,b) => b[1] - a[1]).slice(0,2).map(m => m[0]);
                
                let currentStreak = 0;
                if (entries.length > 0) {
                    const today = new Date(); today.setHours(0,0,0,0);
                    let lastEntryDate = null;
                    const sortedEntriesForStreak = [...entries].sort((a,b) => (a.createdAt?.toDate() || 0) - (b.createdAt?.toDate() || 0));

                    for (const entry of sortedEntriesForStreak.reverse()) { 
                        if (entry.createdAt?.toDate) {
                            const entryDate = entry.createdAt.toDate(); entryDate.setHours(0,0,0,0);
                            if (!lastEntryDate) { 
                                if (entryDate.getTime() === today.getTime() || entryDate.getTime() === new Date(today.getTime() - 86400000).getTime()) {
                                    currentStreak = 1;
                                    lastEntryDate = entryDate;
                                } else { 
                                    break;
                                }
                            } else { 
                                if (entryDate.getTime() === new Date(lastEntryDate.getTime() - 86400000).getTime()) {
                                    currentStreak++;
                                    lastEntryDate = entryDate;
                                } else if (entryDate.getTime() !== lastEntryDate.getTime()) { 
                                    break;
                                }
                            }
                        }
                    }
                }
                setJournalStats({ count: snapshot.size, streak: currentStreak, commonMoods }); 
            });
            return () => { unsubPrefs(); unsubJournal(); };
        } else {
            // Firebase not available, check localStorage
            try {
                const savedPrefs = localStorage.getItem(`${appId}-userPreferences`);
                if (savedPrefs) {
                    setUserPreferences(JSON.parse(savedPrefs));
                } else {
                    setUserPreferences(null);
                }
            } catch (error) {
                console.error("Error loading preferences from localStorage:", error);
                setUserPreferences(null);
            }
            setIsLoadingPreferences(false);
        }
    }, [userId, userPreferences?.completedOnboarding]); 

    const saveUserPreferences = async (prefs) => {
        // Try Firebase first, fall back to localStorage
        if (userId && db) {
            const prefPath = `artifacts/${appId}/users/${userId}/preferences/main`;
            try {
                await setDoc(doc(db, prefPath), prefs, { merge: true });
            } catch (error) { 
                console.error("Error saving preferences to Firebase:", error);
                // Fallback to localStorage
                localStorage.setItem(`${appId}-userPreferences`, JSON.stringify(prefs));
            }
        } else {
            // Firebase not available, use localStorage
            localStorage.setItem(`${appId}-userPreferences`, JSON.stringify(prefs));
        }
        
        // Update local state immediately
        setUserPreferences(prefs);
        
        // If completing onboarding, trigger transition
        if (prefs.completedOnboarding) {
            setJustCompletedOnboarding(true);
        }
    };
    
    const value = useMemo(() => ({
        userId, isAuthReady, userPreferences, saveUserPreferences, isLoadingPreferences, journalStats,
        justCompletedOnboarding, setJustCompletedOnboarding
    }), [userId, isAuthReady, userPreferences, isLoadingPreferences, journalStats, justCompletedOnboarding]);

    return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};
const useUser = () => useContext(UserContext);

// --- Onboarding Screen ---
const OnboardingScreen = () => {
    const { saveUserPreferences } = useUser();
    const { showAlert } = useModal();
    const { effectiveDarkMode, interactiveColor, interactiveRing } = useTheme();
    const [step, setStep] = useState(0);
    const [name, setName] = useState('');
    const [goals, setGoals] = useState([]);
    const [stoicFamiliarity, setStoicFamiliarity] = useState('');
    const [preferredReflectionTime, setPreferredReflectionTime] = useState('');

    const goalOptions = ["Reduce Anxiety/Stress", "Build Resilience", "Improve Focus", "Personal Growth", "Understand Stoicism Better", "Emotional Regulation"];
    const familiarityOptions = ["New to Stoicism", "Somewhat Familiar", "Quite Knowledgeable"];
    const timeOptions = ["Morning (for intention setting)", "Evening (for daily review)", "Anytime inspiration strikes"];

    const handleNext = () => {
        if (step === 1 && !name.trim()) { showAlert("Name Required", "Please share your name, or a nickname."); return; }
        if (step === 2 && goals.length === 0) { showAlert("Goals Required", "Choose at least one area you'd like to focus on."); return; }
        if (step === 3 && !stoicFamiliarity) { showAlert("Familiarity Required", "Let us know your familiarity with Stoicism."); return; }
        if (step === 4 && !preferredReflectionTime) { showAlert("Reflection Time", "When do you prefer to reflect?"); return; }
        
        if (step < 4) {
            setStep(s => s + 1);
        } else {
            saveUserPreferences({ name, goals, stoicFamiliarity, preferredReflectionTime, completedOnboarding: true });
        }
    };

    const toggleGoal = (goal) => setGoals(prev => prev.includes(goal) ? prev.filter(g => g !== goal) : [...prev, goal]);

    const stepsContent = [
        { 
            icon: Feather, title: `Welcome to ${APP_NAME}`, 
            subtitle: "Your personal space for clarity and resilience, guided by Stoic wisdom.", 
            explanation: "This brief setup helps us understand your needs. Your answers will shape a more personalized experience, from the insights you see to the wisdom we highlight, making Aequanimitas truly yours.",
            content: null, buttonText: "Begin" 
        },
        { 
            icon: User, title: "Your Name", 
            subtitle: "What name or nickname feels right for this journey?", 
            explanation: "We'll use this to greet you personally on the 'Today' screen and in messages, making Aequanimitas feel more like your own dedicated space for reflection.",
            content: <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name / Nickname" className={`w-full p-2.5 rounded-lg border text-sm ${effectiveDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-100 border-gray-300 text-gray-800 placeholder-gray-500'} focus:ring-1 ${interactiveRing} outline-none transition-all`} />,
            buttonText: "Next"
        },
        { 
            icon: Target, title: `What are your aspirations, ${name || "Friend"}?`, 
            subtitle: "Select areas where Stoic principles can support you:", 
            explanation: "Your goals directly influence the 'Thought for Today,' suggested actions, and the AI's focus when providing insights on your journal entries, ensuring the guidance is relevant to what you want to achieve.",
            content: <div className="space-y-1.5">{goalOptions.map(g => <motion.button key={g} onClick={() => toggleGoal(g)} className={`w-full p-2.5 rounded-lg border text-left text-sm transition-all ${goals.includes(g) ? `${effectiveDarkMode ? 'bg-gray-200 text-gray-900 border-gray-200' : 'bg-gray-800 text-white border-gray-800'}` : `${effectiveDarkMode ? 'bg-gray-700 hover:bg-gray-600/80 border-gray-600' : 'bg-gray-100 hover:bg-gray-200/80 border-gray-300'}`}`} whileTap={{scale: 0.98}}>{g}</motion.button>)}</div>,
            buttonText: "Next"
        },
        { 
            icon: Brain, title: "Your Stoic Path So Far", 
            subtitle: "How familiar are you with Stoic philosophy?", 
            explanation: "This helps us tailor the complexity of Stoic concepts and the AI explanations for quotes and journal entries, making wisdom accessible whether you're just starting or are well-versed.",
            content: <div className="space-y-1.5">{familiarityOptions.map(f => <motion.button key={f} onClick={() => setStoicFamiliarity(f)} className={`w-full p-2.5 rounded-lg border text-left text-sm transition-all ${stoicFamiliarity === f ? `${effectiveDarkMode ? 'bg-gray-200 text-gray-900 border-gray-200' : 'bg-gray-800 text-white border-gray-800'}` : `${effectiveDarkMode ? 'bg-gray-700 hover:bg-gray-600/80 border-gray-600' : 'bg-gray-100 hover:bg-gray-200/80 border-gray-300'}`}`} whileTap={{scale: 0.98}}>{f}</motion.button>)}</div>,
            buttonText: "Next"
        },
        { 
            icon: CalendarDays, title: "Preferred Reflection Time", 
            subtitle: "When do you usually find the best time for reflection?", 
            explanation: "Knowing this allows us to subtly tailor suggestions on your 'Today' screen. Future updates may include optional, gentle reminders aligned with this preference.",
            content: <div className="space-y-1.5">{timeOptions.map(t => <motion.button key={t} onClick={() => setPreferredReflectionTime(t)} className={`w-full p-2.5 rounded-lg border text-left text-sm transition-all ${preferredReflectionTime === t ? `${effectiveDarkMode ? 'bg-gray-200 text-gray-900 border-gray-200' : 'bg-gray-800 text-white border-gray-800'}` : `${effectiveDarkMode ? 'bg-gray-700 hover:bg-gray-600/80 border-gray-600' : 'bg-gray-100 hover:bg-gray-200/80 border-gray-300'}`}`} whileTap={{scale: 0.98}}>{t}</motion.button>)}</div>,
            buttonText: "Begin Your Journey"
        }
    ];
    
    const currentStepData = stepsContent[step];

    return (
        <motion.div 
            className={`flex flex-col items-center justify-center min-h-screen p-4 transition-colors duration-300 ${effectiveDarkMode ? 'bg-black' : 'bg-gray-50'}`}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
        >
            <AnimatePresence mode="wait">
                <motion.div 
                    key={step} 
                    variants={onboardingPageVariants} 
                    initial="initial" 
                    animate="in" 
                    exit="out" 
                    transition={onboardingPageTransition} 
                    className="w-full max-w-sm"
                >
                    <AnimatedCard className="text-center" noPadding>
                        <div className={`py-5 px-4 ${effectiveDarkMode ? 'bg-gray-800/50' : 'bg-gray-100/50'} rounded-t-xl`}>
                            <currentStepData.icon size={36} className={`mx-auto mb-2.5 ${interactiveColor}`} />
                            <h1 className={`text-xl font-semibold mb-1 ${effectiveDarkMode ? 'text-white' : 'text-gray-800'}`}>{currentStepData.title}</h1>
                            <p className={`text-xs ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{currentStepData.subtitle}</p>
                        </div>
                        <div className="p-4 space-y-4">
                            {currentStepData.explanation && <p className={`text-xs px-2 text-center ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{currentStepData.explanation}</p>}
                            {currentStepData.content && <div className="mt-1">{currentStepData.content}</div>}
                            <StyledButton onClick={handleNext} fullWidth small={false}>
                                {currentStepData.buttonText}
                            </StyledButton>
                        </div>
                    </AnimatedCard>
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
};

// --- Welcome Transition Screen ---
const WelcomeTransitionScreen = ({ onFinished }) => {
    const { userPreferences } = useUser();
    const { effectiveDarkMode, interactiveColor } = useTheme();

    useEffect(() => {
        const timer = setTimeout(onFinished, 3000); 
        return () => clearTimeout(timer);
    }, [onFinished]);

    return (
        <div className={`flex flex-col items-center justify-center h-screen text-center p-6 ${effectiveDarkMode ? 'bg-black' : 'bg-gray-50'}`}>
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                <LogIn size={64} className={`${interactiveColor} mb-4`} /> 
            </motion.div>
            <motion.h1 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.3 }}
                className={`text-2xl font-semibold mb-2 ${effectiveDarkMode ? 'text-white' : 'text-gray-800'}`}
            >
                Welcome, {userPreferences?.name || "Friend"}!
            </motion.h1>
            <motion.p 
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.5 }}
                className={`text-sm ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}
            >
                Your Aequanimitas journey begins now.
            </motion.p>
        </div>
    );
};


// --- Screen Components ---
const ScreenWrapper = ({ children, title }) => {
    const { effectiveDarkMode } = useTheme();
    return (
        <div className="p-4 space-y-4 max-w-2xl mx-auto w-full">
            <motion.h1 
                className={`text-2xl font-semibold ${effectiveDarkMode ? 'text-gray-100' : 'text-gray-800'}`}
                initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            >
                {title}
            </motion.h1>
            {children}
        </div>
    );
};

const TutorialModal = ({ isOpen, onClose }) => {
    const { effectiveDarkMode, interactiveColor } = useTheme();
    const [currentStep, setCurrentStep] = useState(0);

    const tutorialSteps = [
        {
            icon: Feather,
            title: `Welcome to ${APP_NAME}!`,
            content: "This quick tutorial will guide you through the main features of Aequanimitas, your companion for Stoic practice and reflection."
        },
        {
            icon: Home,
            title: "Today Screen",
            content: "Your daily dashboard. Here you'll find a personalized greeting, a snapshot of your progress, a 'Thought for Today,' and suggested actions to guide your reflection."
        },
        {
            icon: BookOpen,
            title: "Journal (My Reflections)",
            content: "Your private space to capture thoughts, feelings, and reflections. You can also get AI-powered insights based on Stoic principles to deepen your understanding."
        },
        {
            icon: Brain,
            title: "Wisdom Library",
            content: "Explore a curated collection of Stoic quotes (expandable with AI explanations), core tenets of the philosophy, and information about key Stoic philosophers."
        },
        {
            icon: Settings,
            title: "Settings",
            content: "Customize your experience. Adjust the app's appearance (Light/Dark/System mode), review your personalization choices, or manage your app data."
        },
        {
            icon: CheckCircle,
            title: "You're All Set!",
            content: "Explore, reflect, and grow. May your journey with Aequanimitas bring you clarity and resilience."
        }
    ];

    const currentTutorialStep = tutorialSteps[currentStep];

    const handleNext = () => {
        if (currentStep < tutorialSteps.length - 1) {
            setCurrentStep(s => s + 1);
        } else {
            onClose(); 
        }
    };

    const handlePrev = () => {
        if (currentStep > 0) {
            setCurrentStep(s => s - 1);
        }
    };
    
    if (!isOpen) return null;

    return (
         <StyledModal isOpen={isOpen} onClose={onClose} title="App Tutorial" size="md">
            <div className="text-center space-y-4">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentStep}
                        initial={{ opacity: 0, x: 50 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -50 }}
                        transition={{ duration: 0.3 }}
                    >
                        <currentTutorialStep.icon size={40} className={`mx-auto mb-3 ${interactiveColor}`} />
                        <h3 className={`text-lg font-semibold mb-2 ${effectiveDarkMode ? 'text-white' : 'text-gray-800'}`}>
                            {currentTutorialStep.title}
                        </h3>
                        <p className={`text-sm px-2 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            {currentTutorialStep.content}
                        </p>
                    </motion.div>
                </AnimatePresence>

                <div className="flex justify-center space-x-1.5 pt-2">
                    {tutorialSteps.map((_, index) => (
                        <motion.div
                            key={index}
                            className={`w-2 h-2 rounded-full transition-colors ${
                                index === currentStep ? (effectiveDarkMode ? 'bg-gray-200' : 'bg-gray-800') : (effectiveDarkMode ? 'bg-gray-600' : 'bg-gray-300')
                            }`}
                            animate={{ scale: index === currentStep ? 1.2 : 1 }}
                        />
                    ))}
                </div>

                <div className="flex justify-between pt-3">
                    <StyledButton onClick={handlePrev} variant="secondary" small disabled={currentStep === 0}>
                        Previous
                    </StyledButton>
                    <StyledButton onClick={handleNext} small>
                        {currentStep === tutorialSteps.length - 1 ? "Finish" : "Next"}
                    </StyledButton>
                </div>
            </div>
        </StyledModal>
    );
};


const TodayScreen = ({ setActiveScreen }) => { 
    const { userPreferences, journalStats } = useUser();
    const { effectiveDarkMode, interactiveColor } = useTheme();
    const [dailyQuote, setDailyQuote] = useState(null);
    const [personalizedMessage, setPersonalizedMessage] = useState("");
    const [suggestedAction, setSuggestedAction] = useState({ text: "New Journal Entry", screen: "journal", icon: Edit3 });
    const [showTutorialModal, setShowTutorialModal] = useState(false);


    useEffect(() => {
        const today = new Date().toDateString();
        const lastQuoteDate = localStorage.getItem(`${appId}-daily-quote-date`);
        let quote;
        if (lastQuoteDate === today) {
            const storedQuote = localStorage.getItem(`${appId}-daily-quote`);
            if (storedQuote) quote = JSON.parse(storedQuote);
        }
        if (!quote) {
            let relevantQuotes = stoicQuotes;
            if (userPreferences?.goals?.length > 0) {
                const lowerCaseGoals = userPreferences.goals.map(g => g.toLowerCase().split(" ")[0]); 
                relevantQuotes = stoicQuotes.filter(q => q.tags.some(tag => lowerCaseGoals.some(goalKeyword => tag.includes(goalKeyword) || goalKeyword.includes(tag))));
                if (relevantQuotes.length === 0) relevantQuotes = stoicQuotes;
            }
            if (userPreferences?.stoicFamiliarity === "New to Stoicism" && relevantQuotes.length > 5) {
                relevantQuotes = relevantQuotes.sort((a,b) => a.tags.length - b.tags.length).slice(0, Math.max(5, Math.floor(relevantQuotes.length / 2)));
            }
            quote = relevantQuotes[Math.floor(Math.random() * relevantQuotes.length)];
            localStorage.setItem(`${appId}-daily-quote`, JSON.stringify(quote));
            localStorage.setItem(`${appId}-daily-quote-date`, today);
        }
        setDailyQuote(quote);

        let message = "Ready to reflect and grow?";
        const currentHour = new Date().getHours();
        const prefTime = userPreferences?.preferredReflectionTime || "";

        if ((prefTime.includes("Morning") && currentHour < 12) || (prefTime.includes("Evening") && currentHour >= 17)) {
            message = `It's ${prefTime.split(" ")[0].toLowerCase()} – your preferred time for reflection.`;
            setSuggestedAction({ text: "Evening Review", screen: "journal", icon: CalendarDays });
        } else if (journalStats.streak > 1) {
            message = `You're on a ${journalStats.streak}-day reflection streak! Keep the momentum.`;
        } else if (userPreferences?.goals?.[0]) {
            message = `Focusing on "${userPreferences.goals[0]}" today? Let's explore that.`;
            setSuggestedAction({ text: `Reflect on ${userPreferences.goals[0]}`, screen: "journal", icon: Target });
        }
        setPersonalizedMessage(message);

    }, [userPreferences, journalStats]);

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 18) return "Good Afternoon";
        return "Good Evening";
    }, []);
    
    const screenTitle = `${greeting}${userPreferences?.name ? `, ${userPreferences.name}` : ""}`;
    const primaryGoal = userPreferences?.goals?.[0] || "Inner Peace";


    return (
        <>
        <ScreenWrapper title={screenTitle}>
            <div className={`-mt-3 mb-3 p-3.5 rounded-lg ${effectiveDarkMode ? 'bg-gray-800/50' : 'bg-white/50'} shadow-sm`}>
                <div className="flex items-center mb-1.5">
                    <Award size={18} className={`mr-2 ${interactiveColor}`} />
                    <h3 className={`text-sm font-medium ${interactiveColor}`}>Your Path: {primaryGoal}</h3>
                </div>
                <p className={`text-xs ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'} mb-2`}>{personalizedMessage}</p>
                <div className="mb-1">
                    <p className={`text-[10px] uppercase tracking-wider ${effectiveDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>This Week's Focus</p>
                    <div className="flex space-x-1 mt-0.5">
                        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, index) => (
                            <div key={day+index} title={day} className={`w-5 h-5 rounded-sm flex items-center justify-center
                                ${index < (new Date().getDay() === 0 ? 6 : new Date().getDay() -1) ? (effectiveDarkMode ? 'bg-gray-600' : 'bg-gray-700') : (effectiveDarkMode ? 'bg-gray-700' : 'bg-gray-300')} 
                                ${index === (new Date().getDay() === 0 ? 6 : new Date().getDay() -1) ? (effectiveDarkMode ? '!bg-gray-200 text-black' : '!bg-black text-white') : ''}
                            `}>
                                <span className="text-[9px] font-medium">{day}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>


            <AnimatedCard custom={0}>
                <h2 className={`text-base font-medium mb-1.5 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Snapshot</h2>
                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className={`${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <ListChecks size={16} className={`inline mr-1 ${interactiveColor}`} />
                        Entries: <span className="font-semibold">{journalStats.count}</span>
                    </div>
                    <div className={`${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                        <TrendingUp size={16} className={`inline mr-1 ${interactiveColor}`} />
                        Streak: <span className="font-semibold">{journalStats.streak} days</span>
                    </div>
                    {journalStats.commonMoods.length > 0 && (
                         <div className={`col-span-2 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                            <Smile size={16} className={`inline mr-1 ${interactiveColor}`} />
                            Often Feeling: <span className="font-semibold">{journalStats.commonMoods.join(', ')}</span>
                        </div>
                    )}
                </div>
            </AnimatedCard>
            {dailyQuote && (
                <AnimatedCard custom={1} onClick={() => setActiveScreen('wisdom')}>
                    <h2 className={`text-base font-medium mb-1 ${interactiveColor}`}>Thought for Today</h2>
                    <blockquote className={`italic text-sm ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                        "{dailyQuote.quote.length > 150 ? dailyQuote.quote.substring(0, 150) + "..." : dailyQuote.quote}"
                    </blockquote>
                    <p className={`text-right text-xs mt-1.5 ${effectiveDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        - {stoicPhilosophers[dailyQuote.author]?.name || dailyQuote.author}
                    </p>
                </AnimatedCard>
            )}
            <AnimatedCard custom={2}>
                 <h2 className={`text-base font-medium mb-1 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Suggested Action</h2>
                 <p className={`text-xs mb-2 ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {userPreferences?.stoicFamiliarity === "New to Stoicism" ? "Explore a core concept or jot down a quick thought." : "Deepen your practice with a reflection or explore related wisdom."}
                 </p>
                 <div className="flex space-x-2">
                    <StyledButton onClick={() => setActiveScreen(suggestedAction.screen)} icon={suggestedAction.icon} small>
                        {suggestedAction.text}
                    </StyledButton>
                    <StyledButton onClick={() => setShowTutorialModal(true)} icon={BookHeart} small variant="secondary">App Tutorial</StyledButton>
                 </div>
            </AnimatedCard>
        </ScreenWrapper>
        <TutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
        </>
    );
};

const JournalScreen = () => { 
    const { effectiveDarkMode, interactiveColor } = useTheme();
    const { userId, userPreferences } = useUser();
    const { showAlert, showConfirm } = useModal();
    const [entries, setEntries] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentEntry, setCurrentEntry] = useState(null);
    const [newEntryContent, setNewEntryContent] = useState("");
    const [selectedMood, setSelectedMood] = useState("");
    const [tags, setTags] = useState([]);
    const [tagInput, setTagInput] = useState("");
    const [aiReflection, setAiReflection] = useState({ entryId: null, text: null, isLoading: false, error: null });

    const moodOptions = ["Peaceful", "Content", "Focused", "Challenged", "Anxious", "Grateful", "Neutral", "Inspired", "Confused", "Hopeful"];
    const journalCollectionPath = useMemo(() => userId ? `artifacts/${appId}/users/${userId}/journalEntries` : null, [userId]);

    useEffect(() => {
        if (!journalCollectionPath || !db) { setIsLoading(false); return; }
        setIsLoading(true);
        const q = query(collection(db, journalCollectionPath), firestoreOrderBy("createdAt", "desc"));
        const unsubscribe = onSnapshot(q, (querySnapshot) => {
            setEntries(querySnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
            setIsLoading(false);
        }, (err) => { console.error("Error fetching journal entries:", err); setIsLoading(false); showAlert("Error", "Could not load journal entries."); });
        return () => unsubscribe();
    }, [journalCollectionPath, showAlert]);
    
    const handleOpenModal = (entry = null) => {
        setCurrentEntry(entry);
        setNewEntryContent(entry ? entry.content : "");
        setSelectedMood(entry ? entry.mood || "" : "");
        setTags(entry ? entry.tags || [] : []);
        setTagInput("");
        setAiReflection({ entryId: null, text: null, isLoading: false, error: null });
        setIsModalOpen(true);
    };
    const handleCloseModal = () => setIsModalOpen(false);

    const handleSaveEntry = async () => {
        if (!newEntryContent.trim()) { showAlert("Empty Entry", "Please write something in your journal."); return; }
        if (!journalCollectionPath || !db) { showAlert("Error", "Cannot save entry. User or database not available."); return; }
        
        const entryData = {
            content: newEntryContent,
            mood: selectedMood,
            tags: tags,
            updatedAt: serverTimestamp(),
        };
        try {
            if (currentEntry) {
                await setDoc(doc(db, journalCollectionPath, currentEntry.id), entryData, { merge: true });
            } else {
                await addDoc(collection(db, journalCollectionPath), { ...entryData, createdAt: serverTimestamp(), userId });
            }
            handleCloseModal();
        } catch (err) { console.error("Error saving entry:", err); showAlert("Save Error", "Could not save your reflection."); }
    };

    const handleDeleteEntry = (entryId) => {
        showConfirm("Delete Reflection?", "This action cannot be undone. Are you sure you want to delete this entry?", async () => {
            if (!journalCollectionPath || !db) { showAlert("Error", "Cannot delete entry. User or database not available."); return; }
            try {
                await deleteDoc(doc(db, journalCollectionPath, entryId));
                if (aiReflection.entryId === entryId) {
                    setAiReflection({ entryId: null, text: null, isLoading: false, error: null });
                }
            } catch (err) { console.error("Error deleting entry:", err); showAlert("Delete Error", "Could not delete the entry."); }
        }, "Delete", "Cancel");
    };
    
    const handleTagInput = (e) => {
        if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
            e.preventDefault();
            const newTag = tagInput.trim().toLowerCase();
            if (!tags.includes(newTag) && tags.length < 5) setTags([...tags, newTag]);
            else if (tags.length >= 5) showAlert("Tag Limit", "You can add up to 5 tags per entry.");
            setTagInput("");
        }
    };
    const removeTag = (tagToRemove) => setTags(tags.filter(tag => tag !== tagToRemove));

    const fetchAiReflection = async (entry) => {
        if (!entry || !entry.content) { showAlert("Cannot Reflect", "Entry content is empty."); return; }
        setAiReflection({ entryId: entry.id, text: null, isLoading: true, error: null });

        const geminiPrompt = `
            Analyze the following journal entry from a Stoic perspective.
            The user's familiarity with Stoicism is "${userPreferences?.stoicFamiliarity || 'not specified'}". 
            Their stated goals include: "${userPreferences?.goals?.join(', ') || 'general personal growth'}".
            Journal Entry: "${entry.content}"
            
            Provide a brief (1-2 concise paragraphs) reflection. Your reflection should:
            1. Acknowledge any apparent emotional states or challenges in the entry.
            2. Gently and briefly connect these to relevant Stoic principles (e.g., dichotomy of control, perception, virtue, acceptance of what is). Avoid being preachy.
            3. Pose 1-2 open-ended, Socratic questions designed to encourage deeper self-reflection from a Stoic viewpoint, considering their goals and familiarity.
            Maintain a supportive, philosophical, and non-prescriptive tone. Focus on guiding self-discovery.
        `;
        try {
            let chatHistory = [{ role: "user", parts: [{ text: geminiPrompt }] }];
            const payload = { contents: chatHistory };
            const apiKey = ""; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData?.error?.message || response.statusText}`);
            }
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                setAiReflection({ entryId: entry.id, text: result.candidates[0].content.parts[0].text, isLoading: false, error: null });
            } else {
                throw new Error("Invalid response structure from AI.");
            }
        } catch (err) {
            console.error("Error getting AI reflection:", err);
            setAiReflection({ entryId: entry.id, text: null, isLoading: false, error: err.message });
        }
    };

    if (isLoading) return <div className={`p-4 text-center text-sm ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Loading reflections...</div>;

    return (
    <ScreenWrapper title="My Reflections">
        {entries.length === 0 && !isLoading && (
            <AnimatedCard className="text-center py-6">
                <BookOpen size={32} className={`mx-auto mb-2 ${effectiveDarkMode ? 'text-gray-500' : 'text-gray-400'}`} />
                <p className={`${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'} text-base`}>Your journal is a space for clarity.</p>
                <p className={`${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'} text-xs mt-0.5`}>Begin by capturing a thought.</p>
                <div className="flex justify-center mt-3">
                    <StyledButton onClick={() => handleOpenModal()} small>Start First Entry</StyledButton>
                </div>
            </AnimatedCard>
        )}

        <motion.div layout className="space-y-3">
        {entries.map((entry, index) => (
            <AnimatedCard key={entry.id} custom={index} noPadding>
                <div className="p-3.5">
                    <p className={`whitespace-pre-wrap text-sm leading-relaxed ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>{entry.content.length > 300 ? entry.content.substring(0,300) + "..." : entry.content}</p>
                    <div className="flex flex-wrap gap-1 mt-2">
                        {entry.mood && <span className={`px-1.5 py-0.5 text-[10px] rounded-full ${effectiveDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-700'}`}>{entry.mood}</span>}
                        {entry.tags?.map(tag => <span key={tag} className={`px-1.5 py-0.5 text-[10px] rounded-full ${effectiveDarkMode ? 'bg-gray-700 text-gray-300' : 'bg-gray-200 text-gray-600'}`}>{tag}</span>)}
                    </div>
                </div>
                {aiReflection.entryId === entry.id && aiReflection.isLoading && (
                    <div className={`p-3 border-t ${effectiveDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                        <p className={`text-xs animate-pulse ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>AI Sage is reflecting...</p>
                    </div>
                )}
                {aiReflection.entryId === entry.id && aiReflection.error && (
                    <div className={`p-3 border-t ${effectiveDarkMode ? 'border-gray-700 bg-red-900/20' : 'border-gray-200 bg-red-50/50'}`}>
                        <p className={`text-xs text-red-500`}>AI Error: {aiReflection.error}</p>
                    </div>
                )}
                {aiReflection.entryId === entry.id && aiReflection.text && !aiReflection.isLoading && (
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className={`p-3 border-t ${effectiveDarkMode ? 'border-gray-700/80 bg-gray-800/40' : 'border-gray-200/80 bg-gray-100/40'}`}
                    >
                        <div className="flex items-center mb-1">
                            <Sparkles size={14} className={`mr-1.5 ${interactiveColor}`} />
                            <h4 className={`text-xs font-semibold ${interactiveColor}`}>AI Sage's Insight:</h4>
                        </div>
                        <p className={`whitespace-pre-wrap text-xs leading-normal ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>{aiReflection.text}</p>
                    </motion.div>
                )}

                <div className={`border-t p-2 flex justify-between items-center ${effectiveDarkMode ? 'border-gray-700/70' : 'border-gray-200/70'}`}>
                    <p className={`text-[10px] ${effectiveDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                        {entry.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </p>
                    <div className="flex space-x-1"> 
                        <StyledButton onClick={() => fetchAiReflection(entry)} icon={Sparkles} variant="ai" small disabled={aiReflection.isLoading && aiReflection.entryId === entry.id}>AI Insight</StyledButton>
                        <StyledButton onClick={() => handleOpenModal(entry)} icon={Edit3} variant="ghost" small />
                        <StyledButton onClick={() => handleDeleteEntry(entry.id)} icon={Trash2} variant="ghost" small className={`!text-red-500/70 hover:!bg-red-500/10`} />
                    </div>
                </div>
            </AnimatedCard>
        ))}
        </motion.div>

        <FAB onClick={() => handleOpenModal(null)} icon={Plus} label="New Reflection" />

        <StyledModal isOpen={isModalOpen} onClose={handleCloseModal} title={currentEntry ? "Edit Reflection" : "New Reflection"} size="lg">
            <div className="space-y-3.5">
                <textarea
                    value={newEntryContent}
                    onChange={(e) => setNewEntryContent(e.target.value)}
                    placeholder="Let your thoughts flow..."
                    rows="6"
                    className={`w-full p-2.5 rounded-lg border text-sm ${effectiveDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-500'} focus:ring-1 ${effectiveDarkMode ? 'focus:ring-gray-500' : 'focus:ring-gray-400'} outline-none`}
                />
                <div> 
                    <label className={`block text-xs font-medium mb-1 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Mood (Optional)</label>
                    <div className="flex flex-wrap gap-1.5">
                        {moodOptions.map(mood => (
                            <motion.button key={mood} onClick={() => setSelectedMood(mood)}
                                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors
                                ${selectedMood === mood ? `${effectiveDarkMode ? 'bg-gray-200 text-gray-900 border-gray-200' : 'bg-gray-800 text-white border-gray-800'}` : `${effectiveDarkMode ? 'border-gray-600 hover:bg-gray-600/50' : 'border-gray-300 hover:bg-gray-200/70'}`}`}
                                whileTap={{scale:0.95}}
                            >{mood}</motion.button>
                        ))}
                        {selectedMood && <StyledButton onClick={() => setSelectedMood("")} icon={XCircle} variant="ghost" small>Clear</StyledButton>}
                    </div>
                </div>
                 <div>
                    <label className={`block text-xs font-medium mb-1 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Tags (Optional, max 5)</label>
                    <div className="flex flex-wrap gap-1 mb-1.5">
                        {tags.map(tag => (
                            <span key={tag} className={`flex items-center px-1.5 py-0.5 rounded-full text-[10px] ${effectiveDarkMode ? 'bg-gray-600 text-gray-200' : 'bg-gray-200 text-gray-700'}`}>
                                {tag} <XCircle size={12} className="ml-1 cursor-pointer hover:text-red-400" onClick={() => removeTag(tag)} />
                            </span>
                        ))}
                    </div>
                    <input type="text" placeholder="Add tags (comma or Enter)" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={handleTagInput}
                     className={`w-full p-2 rounded-lg border text-sm ${effectiveDarkMode ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' : 'bg-gray-50 border-gray-300 text-gray-800 placeholder-gray-500'} focus:ring-1 ${effectiveDarkMode ? 'focus:ring-gray-500' : 'focus:ring-gray-400'} outline-none`} />
                </div>
                <div className="flex justify-end pt-1">
                    <StyledButton onClick={handleSaveEntry} icon={CheckCircle} small={false}>Save Reflection</StyledButton>
                </div>
            </div>
        </StyledModal>
    </ScreenWrapper>
    );
};

const WisdomScreen = () => {
    const { effectiveDarkMode, interactiveColor } = useTheme();
    const { userPreferences } = useUser();
    const { showAlert } = useModal();
    const [searchTerm, setSearchTerm] = useState("");
    const [activeTab, setActiveTab] = useState("quotes");
    const [selectedPhilosopherKey, setSelectedPhilosopherKey] = useState(null); 
    const [selectedTenetKey, setSelectedTenetKey] = useState(null); 
    const [expandedQuoteId, setExpandedQuoteId] = useState(null); 
    const [aiQuoteExplanation, setAiQuoteExplanation] = useState({ quoteId: null, text: null, isLoading: false, error: null });

    const quotesByPhilosopher = useMemo(() => {
        return stoicQuotes.reduce((acc, quote) => {
            const authorKey = quote.author;
            if (!acc[authorKey]) acc[authorKey] = [];
            acc[authorKey].push(quote);
            return acc;
        }, {});
    }, []);

    const filteredPhilosopherKeysForQuotesTab = useMemo(() => {
        let keys = Object.keys(stoicPhilosophers);
        if (searchTerm) {
            keys = keys.filter(key => 
                stoicPhilosophers[key].name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (quotesByPhilosopher[key] || []).some(q => q.quote.toLowerCase().includes(searchTerm.toLowerCase()))
            );
        }
        return keys.sort((a,b) => stoicPhilosophers[a].name.localeCompare(stoicPhilosophers[b].name));
    }, [searchTerm, quotesByPhilosopher]);
    
    const filteredTenets = useMemo(() => Object.entries(stoicTenets).filter(([key, tenet]) => 
        tenet.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenet.summary.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenet.explanation.toLowerCase().includes(searchTerm.toLowerCase())
    ), [searchTerm]);

    const filteredPhilosophersForPhilosophersTab = useMemo(() => Object.entries(stoicPhilosophers).filter(([key, p]) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.bio.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.summary.toLowerCase().includes(searchTerm.toLowerCase())
    ).sort(([,a],[,b]) => a.name.localeCompare(b.name)), [searchTerm]);


    const fetchAiQuoteExplanation = async (quote) => {
        if (!quote) return;
        setAiQuoteExplanation({ quoteId: quote.id, text: null, isLoading: true, error: null });
        const philosopherName = stoicPhilosophers[quote.author]?.name || quote.author;
        const geminiPrompt = `
            Provide a concise explanation of the following Stoic quote:
            Quote: "${quote.quote}"
            Author: ${philosopherName}

            Your explanation should cover:
            1. The core meaning of the quote.
            2. Its significance within Stoic philosophy.
            3. A practical way to apply this wisdom in daily life.
            ${userPreferences?.goals?.[0] ? `Consider its relevance to someone focusing on: "${userPreferences.goals[0]}".` : ""}
            Keep the explanation to 1-2 paragraphs and maintain a supportive, insightful tone.
        `;
        try {
            const payload = { contents: [{ role: "user", parts: [{ text: geminiPrompt }] }] };
            const apiKey = ""; 
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
            const response = await fetch(apiUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${errorData?.error?.message || response.statusText}`);
            }
            const result = await response.json();
            if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
                setAiQuoteExplanation({ quoteId: quote.id, text: result.candidates[0].content.parts[0].text, isLoading: false, error: null });
            } else {
                throw new Error("Invalid response structure from AI for quote explanation.");
            }
        } catch (err) {
            console.error("Error getting AI quote explanation:", err);
            setAiQuoteExplanation({ quoteId: quote.id, text: null, isLoading: false, error: err.message });
            showAlert("AI Error", "Could not fetch explanation for this quote.");
        }
    };


    const tabs = [
        { id: "quotes", label: "Quotes", icon: FileText },
        { id: "tenets", label: "Core Tenets", icon: Layers },
        { id: "philosophers", label: "Philosophers", icon: Users },
    ];

    const renderContent = () => {
        if (selectedPhilosopherKey) { 
            const p = stoicPhilosophers[selectedPhilosopherKey];
            if (!p) { 
                showAlert("Error", "Philosopher data not found.");
                setSelectedPhilosopherKey(null);
                return null;
            }
            const quotesByThisPhilosopher = stoicQuotes.filter(q => q.author === selectedPhilosopherKey);
            return (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-3.5">
                    <StyledButton onClick={() => setSelectedPhilosopherKey(null)} icon={ChevronLeft} variant="ghost" small>Back to Philosophers</StyledButton>
                    <AnimatedCard>
                        <h2 className={`text-xl font-semibold ${interactiveColor}`}>{p.name} <span className={`text-xs font-normal ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>({p.era})</span></h2>
                        <p className={`text-sm mt-1.5 leading-relaxed ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{p.bio}</p>
                        <p className={`text-xs mt-2 ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Key Works: {p.keyWorks.join(', ')}</p>
                    </AnimatedCard>
                    <h3 className={`text-lg font-medium pt-2 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Quotes by {p.name}:</h3>
                    {quotesByThisPhilosopher.map((q,i) => ( 
                        <AnimatedCard key={q.id} custom={i} className="text-sm">
                             <blockquote className={`italic ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>"{q.quote}"</blockquote>
                        </AnimatedCard>
                    ))}
                    {quotesByThisPhilosopher.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No quotes by this philosopher in our collection yet.</p>}
                </motion.div>
            );
        }
        if (selectedTenetKey) { 
            const t = stoicTenets[selectedTenetKey];
             if (!t) { 
                showAlert("Error", "Tenet data not found.");
                setSelectedTenetKey(null);
                return null;
            }
            const relatedQuotes = stoicQuotes.filter(q => q.tags.includes(selectedTenetKey) || q.quote.toLowerCase().includes(t.title.split(" ")[0].toLowerCase()));
             return (
                <motion.div initial={{opacity:0}} animate={{opacity:1}} className="space-y-3.5">
                    <StyledButton onClick={() => setSelectedTenetKey(null)} icon={ChevronLeft} variant="ghost" small>Back to Tenets</StyledButton>
                    <AnimatedCard>
                        <div className="flex items-center mb-1.5">
                            <t.icon size={20} className={`mr-2 ${interactiveColor}`} />
                            <h2 className={`text-xl font-semibold ${interactiveColor}`}>{t.title}</h2>
                        </div>
                        <p className={`text-sm leading-relaxed ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{t.explanation || t.summary}</p>
                    </AnimatedCard>
                    <h3 className={`text-lg font-medium pt-2 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Related Quotes:</h3>
                    {relatedQuotes.map((q,i) => (
                        <AnimatedCard key={q.id} custom={i} className="text-sm">
                            <blockquote className={`italic ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>"{q.quote}"</blockquote>
                             <p className={`text-right text-xs mt-1 ${effectiveDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>- {stoicPhilosophers[q.author]?.name || q.author}</p>
                        </AnimatedCard>
                    ))}
                    {relatedQuotes.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No directly related quotes found.</p>}
                </motion.div>
            );
        }

        switch(activeTab) {
            case "quotes": return (
                <div className="space-y-3.5">
                    {filteredPhilosopherKeysForQuotesTab.map((philosopherKey, i) => {
                        const philosopher = stoicPhilosophers[philosopherKey];
                        const quotes = (quotesByPhilosopher[philosopherKey] || []).filter(q => 
                            !searchTerm || q.quote.toLowerCase().includes(searchTerm.toLowerCase()) || philosopher.name.toLowerCase().includes(searchTerm.toLowerCase())
                        );
                        if (quotes.length === 0 && searchTerm && !philosopher.name.toLowerCase().includes(searchTerm.toLowerCase())) return null; 
                        if (quotes.length === 0 && !searchTerm) return null; 

                        return (
                            <AnimatedCard key={philosopherKey} custom={i} noPadding>
                                <div className={`w-full p-3 text-left ${effectiveDarkMode ? 'bg-gray-700/30' : 'bg-gray-100/30'} rounded-t-xl`}>
                                    <h3 className={`text-base font-semibold ${interactiveColor}`}>{philosopher.name}</h3>
                                </div>
                                <div className="px-3 pb-3 space-y-2.5">
                                    {quotes.map(q => (
                                        <div key={q.id} className={`p-2.5 rounded-md ${effectiveDarkMode ? 'bg-gray-700/50' : 'bg-gray-100/50'}`}>
                                            <blockquote 
                                                className={`italic text-sm cursor-pointer ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-700'}`}
                                                onClick={() => setExpandedQuoteId(expandedQuoteId === q.id ? null : q.id)}
                                            >
                                                "{expandedQuoteId === q.id ? q.quote : (q.quote.length > 120 ? q.quote.substring(0, 120) + "..." : q.quote)}"
                                            </blockquote>
                                            {expandedQuoteId === q.id && (
                                                <div className="mt-2 pt-2 border-t border-gray-600/50">
                                                    <StyledButton 
                                                        onClick={() => fetchAiQuoteExplanation(q)} 
                                                        icon={Lightbulb} 
                                                        variant="ai" 
                                                        small 
                                                        isLoading={aiQuoteExplanation.isLoading && aiQuoteExplanation.quoteId === q.id}
                                                    >
                                                        AI Explanation
                                                    </StyledButton>
                                                    {aiQuoteExplanation.quoteId === q.id && aiQuoteExplanation.text && !aiQuoteExplanation.isLoading && (
                                                        <p className={`text-xs mt-1.5 p-2 rounded ${effectiveDarkMode ? 'bg-gray-600/50 text-gray-300' : 'bg-gray-200/50 text-gray-700'}`}>
                                                            {aiQuoteExplanation.text}
                                                        </p>
                                                    )}
                                                    {aiQuoteExplanation.quoteId === q.id && aiQuoteExplanation.error && (
                                                        <p className="text-xs text-red-500 mt-1.5">Error: {aiQuoteExplanation.error}</p>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                     {quotes.length === 0 && searchTerm && <p className={`text-xs text-center py-2 ${effectiveDarkMode ? 'text-gray-500' : 'text-gray-400'}`}>No quotes by {philosopher.name} match your search.</p>}
                                </div>
                            </AnimatedCard>
                        );
                    })}
                    {filteredPhilosopherKeysForQuotesTab.length === 0 && <p className={`${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center py-4 text-xs`}>No quotes or philosophers match your search.</p>}
                </div>
            );
            case "tenets": return ( 
                <div className="space-y-3">
                    {(filteredTenets.length > 0 || searchTerm ? filteredTenets : Object.entries(stoicTenets)).map(([key, tenet], i) => ( 
                         <AnimatedCard key={key} custom={i} onClick={() => setSelectedTenetKey(key)}>
                            <div className="flex items-start space-x-2.5">
                                <tenet.icon size={20} className={`mt-0.5 ${interactiveColor} flex-shrink-0`} />
                                <div>
                                    <h3 className={`text-base font-semibold mb-0.5 ${effectiveDarkMode ? 'text-gray-100' : 'text-gray-800'}`}>{tenet.title}</h3>
                                    <p className={`text-xs ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{tenet.summary}</p>
                                </div>
                            </div>
                        </AnimatedCard>
                    ))}
                     {filteredTenets.length === 0 && searchTerm && <p className={`${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center py-4 text-xs`}>No tenets match your search.</p>}
                </div>
            );
            case "philosophers": return ( 
                <div className="space-y-3">
                     {(filteredPhilosophersForPhilosophersTab.length > 0 || searchTerm ? filteredPhilosophersForPhilosophersTab : Object.entries(stoicPhilosophers)).map(([key, p], i) => ( 
                         <AnimatedCard key={key} custom={i} onClick={() => setSelectedPhilosopherKey(key)}>
                            <h3 className={`text-base font-semibold ${interactiveColor}`}>{p.name} <span className={`text-xs font-normal ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>({p.era})</span></h3>
                            <p className={`text-xs mt-0.5 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{p.summary}</p>
                        </AnimatedCard>
                    ))}
                    {filteredPhilosophersForPhilosophersTab.length === 0 && searchTerm && <p className={`${effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'} text-center py-4 text-xs`}>No philosophers match your search.</p>}
                </div>
            );
            default: return null;
        }
    };

    return (
    <ScreenWrapper title="Stoic Library">
        { !selectedPhilosopherKey && !selectedTenetKey && (
            <div className={`sticky top-0 z-10 py-2 -mx-4 px-4 ${effectiveDarkMode ? 'bg-black/80' : 'bg-gray-100/80'} backdrop-blur-md`}>
                <div className="relative mb-2.5">
                    <input type="text" placeholder="Search wisdom..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                        className={`w-full p-2.5 pl-9 text-sm rounded-lg border ${effectiveDarkMode ? 'bg-gray-800 border-gray-700 text-white placeholder-gray-400' : 'bg-white border-gray-300 text-gray-800 placeholder-gray-500'} focus:ring-1 ${effectiveDarkMode ? 'focus:ring-gray-500' : 'focus:ring-gray-400'} outline-none transition-all`}
                    />
                    <Search size={16} className={`absolute left-2.5 top-1/2 -translate-y-1/2 ${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />
                </div>
                <div className={`flex space-x-0.5 border-b ${effectiveDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                    {tabs.map(tab => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); setSearchTerm(""); setSelectedPhilosopherKey(null); setSelectedTenetKey(null); setExpandedQuoteId(null); setAiQuoteExplanation({ quoteId: null, text: null, isLoading: false, error: null });}}
                            className={`px-2.5 py-2 text-xs font-medium flex items-center space-x-1 transition-colors
                                        ${activeTab === tab.id ? `border-b-2 ${effectiveDarkMode ? 'border-gray-200 text-gray-100' : 'border-gray-800 text-gray-800'}` 
                                                              : `${effectiveDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'}`}`}>
                            <tab.icon size={14} /> <span>{tab.label}</span>
                        </button>
                    ))}
                </div>
            </div>
        )}

        <AnimatePresence mode="wait">
            <motion.div key={activeTab + (selectedPhilosopherKey || "") + (selectedTenetKey || "")} variants={pageVariants} initial="initial" animate="in" exit="out" transition={{duration: 0.15}}>
                {renderContent()}
            </motion.div>
        </AnimatePresence>
    </ScreenWrapper>
    );
};

const SettingsScreen = () => {
    const { mode, changeMode, effectiveDarkMode, interactiveColor } = useTheme();
    const { userId, userPreferences, saveUserPreferences } = useUser();
    const { showAlert, showConfirm } = useModal();
    const [isModeDropdownOpen, setIsModeDropdownOpen] = useState(false);

    const handleResetOnboarding = () => {
        showConfirm("Reset Personalization?", "This will clear your current preferences and you'll go through the setup questions again.",
        async () => {
            await saveUserPreferences({ completedOnboarding: false, name: '', goals: [], stoicFamiliarity: '', preferredReflectionTime: '' });
            showAlert("Personalization Reset", "Your preferences have been reset.");
        });
    };
    
    const handleClearJournal = () => {
        showConfirm("Clear ALL Journal Entries?", "DANGER: This action is permanent and cannot be undone. All your reflections will be lost.",
        async () => {
            if (!userId || !db) { showAlert("Error", "User or database not available."); return; }
            const journalPath = `artifacts/${appId}/users/${userId}/journalEntries`;
            const q = query(collection(db, journalPath));
            try {
                const snapshot = await getDocs(q);
                if (snapshot.empty) { showAlert("Journal Empty", "There are no journal entries to delete."); return; }
                
                const batch = writeBatch(db);
                snapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                showAlert("Journal Cleared", "All your journal entries have been successfully deleted.");
            } catch (error) {
                console.error("Error clearing journal:", error);
                showAlert("Error Clearing Journal", "Failed to delete journal entries. Please try again.");
            }
        }, "Delete All", "Cancel");
    };

    const modeOptions = [
        { value: 'light', label: 'Light', icon: Sun },
        { value: 'dark', label: 'Dark', icon: Moon },
        { value: 'system', label: 'System', icon: Settings } 
    ];

    return (
        <ScreenWrapper title="Settings">
            <AnimatedCard custom={0} className={isModeDropdownOpen ? 'z-30' : 'z-0'}> {/* Conditional z-index */}
                <h2 className={`text-base font-medium mb-2 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Appearance</h2>
                <div className="relative"> {/* Parent of dropdown needs to allow overflow or have sufficient z-index */}
                    <label htmlFor="mode-select" className={`block text-sm mb-1 ${effectiveDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>Mode</label>
                    <button 
                        onClick={() => setIsModeDropdownOpen(!isModeDropdownOpen)}
                        className={`w-full flex justify-between items-center p-2.5 rounded-lg border text-sm ${effectiveDarkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-100 border-gray-300 text-gray-800'} focus:ring-1 ${effectiveDarkMode ? 'focus:ring-gray-500' : 'focus:ring-gray-400'} outline-none`}
                    >
                        <span>{modeOptions.find(o => o.value === mode)?.label || "Select Mode"}</span>
                        <ChevronDown size={16} className={`transition-transform ${isModeDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                    <AnimatePresence>
                    {isModeDropdownOpen && (
                        <motion.ul 
                            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                            // Dropdown itself already has z-20 from previous attempts, ensure parent card is lifted
                            className={`absolute mt-1 w-full rounded-lg shadow-lg border py-1 z-20 ${effectiveDarkMode ? 'bg-gray-700 border-gray-600' : 'bg-white border-gray-200'}`}
                        >
                            {modeOptions.map(opt => (
                                <li key={opt.value}>
                                    <button 
                                        onClick={() => { changeMode(opt.value); setIsModeDropdownOpen(false); }}
                                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center space-x-2 ${effectiveDarkMode ? 'hover:bg-gray-600 text-gray-200' : 'hover:bg-gray-100 text-gray-800'} ${mode === opt.value ? (effectiveDarkMode ? 'bg-gray-600' : 'bg-gray-100') : ''}`}
                                    >
                                        <opt.icon size={14} /> <span>{opt.label}</span>
                                    </button>
                                </li>
                            ))}
                        </motion.ul>
                    )}
                    </AnimatePresence>
                </div>
            </AnimatedCard>

            <AnimatedCard custom={1}> 
                <h2 className={`text-base font-medium mb-1.5 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Personalization</h2>
                 {userPreferences && (
                    <div className="text-xs space-y-0.5 mb-2">
                        <p className={effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'}>Name: {userPreferences.name || "Not set"}</p>
                        <p className={effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'}>Goals: {userPreferences.goals?.join(', ') || "Not set"}</p>
                        <p className={effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'}>Familiarity: {userPreferences.stoicFamiliarity || "Not set"}</p>
                        <p className={effectiveDarkMode ? 'text-gray-400' : 'text-gray-600'}>Reflection Time: {userPreferences.preferredReflectionTime || "Not set"}</p>
                    </div>
                )}
                <StyledButton onClick={handleResetOnboarding} icon={User} variant="secondary" small>
                    Redo Setup Questions
                </StyledButton>
            </AnimatedCard>
            
            <AnimatedCard custom={2}>
                <h2 className={`text-base font-medium mb-1.5 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>Data Management</h2>
                 <StyledButton onClick={handleClearJournal} icon={Trash2} variant="danger" small>
                    Clear All Journal Entries
                </StyledButton>
            </AnimatedCard>

            <AnimatedCard custom={3}>
                <h2 className={`text-base font-medium mb-1 ${effectiveDarkMode ? 'text-gray-200' : 'text-gray-700'}`}>About {APP_NAME}</h2>
                <p className={`${effectiveDarkMode ? 'text-gray-400' : 'text-gray-500'} text-xs`}>Version {APP_VERSION}</p>
            </AnimatedCard>
        </ScreenWrapper>
    );
};


// --- App Shell & Navigation ---
const AppShell = () => {
    const { effectiveDarkMode } = useTheme(); 
    const [activeScreen, setActiveScreen] = useState('today');

    const navItems = [
        { id: 'today', label: 'Today', icon: Home },
        { id: 'journal', label: 'Journal', icon: BookOpen },
        { id: 'wisdom', label: 'Wisdom', icon: Brain },
        { id: 'settings', label: 'Settings', icon: Settings },
    ];

    const renderScreen = () => {
        switch (activeScreen) {
            case 'today': return <TodayScreen setActiveScreen={setActiveScreen} />;
            case 'journal': return <JournalScreen />;
            case 'wisdom': return <WisdomScreen />;
            case 'settings': return <SettingsScreen />;
            default: return <TodayScreen setActiveScreen={setActiveScreen} />;
        }
    };
    
    const backgroundStyle = effectiveDarkMode ? `bg-black` : `bg-gray-100`;

    return (
        <div className={`flex flex-col h-screen font-sans antialiased transition-colors duration-300 ${backgroundStyle}`}>
            <motion.main
                className="flex-1 overflow-y-auto pb-24" 
                key={activeScreen} 
                variants={pageVariants} initial="initial" animate="in" exit="out" transition={pageTransition}
            >
                {renderScreen()}
            </motion.main>

            <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
                <nav className={`flex items-center space-x-1 p-1.5 rounded-xl shadow-2xl
                                ${effectiveDarkMode ? 'bg-gray-800/70 border border-gray-700/60' : 'bg-white/70 border border-gray-200/60'}
                                backdrop-blur-lg`}>
                    {navItems.map(item => (
                        <motion.button
                            key={item.id}
                            onClick={() => setActiveScreen(item.id)}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg transition-colors duration-150 w-16 h-14 relative
                                        ${activeScreen === item.id ? (effectiveDarkMode ? 'bg-gray-600/50' : 'bg-gray-200/70') : ''}
                                        ${activeScreen === item.id ? (effectiveDarkMode ? 'text-white' : 'text-black') : (effectiveDarkMode ? 'text-gray-400 hover:text-gray-100' : 'text-gray-500 hover:text-gray-900')}`}
                            whileTap={{ scale: 0.90 }}
                            whileHover={{ scale: 1.1, y: -2 }}
                        >
                            <item.icon size={20} strokeWidth={activeScreen === item.id ? 2.5 : 2} />
                            <span className="text-[10px] mt-0.5">{item.label}</span>
                            {activeScreen === item.id && (
                                <motion.div
                                    layoutId="activeNavIndicator"
                                    className={`absolute -bottom-1.5 h-1 w-1 rounded-full ${effectiveDarkMode ? 'bg-gray-200' : 'bg-gray-800'}`}
                                />
                            )}
                        </motion.button>
                    ))}
                </nav>
            </div>
        </div>
    );
};

// --- Main App Component ---
const App = () => {
    return (
        <ThemeProvider>
            <ModalProvider> 
                <UserProvider>
                    <AppLoader />
                </UserProvider>
            </ModalProvider>
        </ThemeProvider>
    );
};

const AppLoader = () => {
    const { isAuthReady, userPreferences, isLoadingPreferences, justCompletedOnboarding, setJustCompletedOnboarding } = useUser();
    const { effectiveDarkMode, interactiveColor } = useTheme();

    if (!isAuthReady || isLoadingPreferences) {
        return (
            <div className={`flex flex-col items-center justify-center h-screen ${effectiveDarkMode ? 'bg-black text-gray-300' : 'bg-gray-100 text-gray-700'}`}>
                <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}>
                    <Feather size={36} className={interactiveColor} />
                </motion.div>
                <p className="mt-2.5 text-xs">Preparing your Stoic space...</p>
            </div>
        );
    }

    if (!userPreferences?.completedOnboarding) {
        return <OnboardingScreen />;
    }
    
    if (justCompletedOnboarding) {
        return <WelcomeTransitionScreen onFinished={() => setJustCompletedOnboarding(false)} />;
    }

    return <AppShell />;
};

export default App;

