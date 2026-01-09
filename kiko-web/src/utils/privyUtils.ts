export const clearWalletData = () => {
    try {
        localStorage.removeItem('privy:token');
        localStorage.removeItem('privy:user');
        localStorage.removeItem('privy:wallet');
    } catch (e) {
        // Ignored
    }
};

/**
 * Extracts user display name, initials, and avatar URL from Privy user object
 */
export const getUserInfo = (user: any) => {
    if (!user) return { name: 'User', initials: 'U', avatarUrl: null };

    // 1. Extract Name
    const emailAddress = user.email && typeof user.email === 'object' && 'address' in user.email
        ? (user.email as { address: string }).address
        : (typeof user.email === 'string' ? user.email : null);

    const name = user.farcaster?.username ||
        user.twitter?.username ||
        user.discord?.username ||
        (emailAddress ? emailAddress.split('@')[0] : null) ||
        (user.wallet?.address ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-2)}` : 'User');

    // 2. Extract Initials
    const initials = name.substring(0, 2).toUpperCase();

    // 3. Extract Avatar
    let avatarUrl: string | null = null;

    // Check direct properties
    if (user.farcaster?.pfp) avatarUrl = user.farcaster.pfp;
    else if (user.twitter?.profilePictureUrl) avatarUrl = user.twitter.profilePictureUrl;
    else if (user.twitter?.profile_picture_url) avatarUrl = user.twitter.profile_picture_url;
    else if (user.google?.profilePictureUrl) avatarUrl = user.google.profilePictureUrl;
    else if (user.google?.picture) avatarUrl = user.google.picture;
    else if (user.discord?.profilePictureUrl) avatarUrl = user.discord.profilePictureUrl;
    else if (user.discord?.avatar_url) avatarUrl = user.discord.avatar_url;
    else if (user.github?.profilePictureUrl) avatarUrl = user.github.profilePictureUrl;
    else if (user.photoUrl) avatarUrl = user.photoUrl;
    else if (user.photo_url) avatarUrl = user.photo_url;

    // Fallback to linkedAccounts
    if (!avatarUrl && user.linkedAccounts) {
        const socialAcc = user.linkedAccounts.find((acc: any) =>
            acc.profilePictureUrl || acc.pfp || acc.profile_picture_url || acc.photoUrl || acc.photo_url || acc.picture
        );
        if (socialAcc) {
            avatarUrl = socialAcc.profilePictureUrl || socialAcc.pfp || socialAcc.profile_picture_url || socialAcc.photoUrl || socialAcc.photo_url || socialAcc.picture;
        }
    }

    return { name, initials, avatarUrl };
};
