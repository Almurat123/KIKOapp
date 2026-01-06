export const clearWalletData = () => {
    localStorage.removeItem('privy:token');
    localStorage.removeItem('privy:user');
    localStorage.removeItem('privy:wallet');
    // Add other privy related keys if known
};
