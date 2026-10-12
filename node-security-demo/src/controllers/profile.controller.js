export function getProfile(req, res) {
    return res.json({
        user: {
            id: req.user.id,
            role: req.user.role
        }
    });
}
