const express = require('express');
const router = express.Router();
const { queryDatabase } = require('../../lib_login/db');
const { authenticateUser, checkAdminRole } = require('../../lib_login/authMiddleware');

/**
 * GET /api/subscriptions/status
 * Check current center subscription status
 */
router.get('/status', authenticateUser, async (req, res) => {
    try {
        const user = req.user;

        // Only for center users
        if (!user.centerID) {
            return res.json({
                hasSubscription: false,
                message: 'Not a center user'
            });
        }

        // Get subscription details
        const [subscription] = await queryDatabase(`
            SELECT * FROM center_subscriptions 
            WHERE center_id = ? AND status IN ('active', 'trial')
            ORDER BY created_at DESC LIMIT 1
        `, [user.centerID]);

        if (!subscription) {
            return res.json({
                hasSubscription: false,
                status: 'expired',
                message: 'No active subscription found'
            });
        }

        // Check if trial expired
        const now = new Date();
        if (subscription.status === 'trial' && new Date(subscription.trial_ends_at) < now) {
            // Update to suspended if trial expired
            await queryDatabase('UPDATE center_subscriptions SET status = "suspended" WHERE id = ?', [subscription.id]);
            return res.json({
                hasSubscription: false,
                status: 'expired',
                message: 'Trial period ended'
            });
        }

        res.json({
            hasSubscription: true,
            status: subscription.status,
            plan: subscription.plan_type,
            trialEndsAt: subscription.trial_ends_at,
            nextBillingDate: subscription.next_billing_date,
            limits: {
                storage: subscription.storage_limit_bytes,
                students: subscription.student_limit
            }
        });

    } catch (error) {
        console.error('Subscription Status Error:', error);
        res.status(500).json({ error: 'Failed to fetch subscription status' });
    }
});

/**
 * POST /api/subscriptions/upgrade
 * Upgrade to Premium (Mock Implementation for MVP)
 * Only Center Admin can perform this.
 */
router.post('/upgrade', authenticateUser, async (req, res) => {
    try {
        const user = req.user;
        const { planType = 'premium' } = req.body;

        if (user.role !== 'admin' && user.account_type !== 'center_admin') {
            return res.status(403).json({ error: 'Only center admins can upgrade plan' });
        }

        if (!user.centerID) {
            return res.status(400).json({ error: 'No center associated' });
        }

        // Check existing active subscription
        const [existing] = await queryDatabase(`
            SELECT id FROM center_subscriptions 
            WHERE center_id = ? AND status = 'active'
        `, [user.centerID]);

        if (existing) {
            // Update existing
            await queryDatabase(`
                UPDATE center_subscriptions 
                SET plan_type = ?, storage_limit_bytes = ?, price_monthly = ?
                WHERE id = ?
             `, [planType, 107374182400, 220000, existing.id]); // 100GB
        } else {
            // Create new
            await queryDatabase(`
                INSERT INTO center_subscriptions 
                (center_id, plan_type, storage_limit_bytes, price_monthly, status, next_billing_date)
                VALUES (?, ?, ?, ?, 'active', DATE_ADD(NOW(), INTERVAL 1 MONTH))
            `, [user.centerID, planType, 107374182400, 220000]); // 100GB
        }

        res.json({ success: true, message: `Upgraded to ${planType} plan successfully!` });

    } catch (error) {
        console.error('Upgrade Error:', error);
        res.status(500).json({ error: 'Upgrade failed' });
    }
});

/**
 * POST /api/subscriptions/cancel
 * Cancel Subscription
 */
router.post('/cancel', authenticateUser, async (req, res) => {
    try {
        const user = req.user;

        if (user.role !== 'admin' && user.account_type !== 'center_admin') {
            return res.status(403).json({ error: 'Only center admins can cancel plan' });
        }

        await queryDatabase(`
            UPDATE center_subscriptions 
            SET status = 'cancelled'
            WHERE center_id = ? AND status IN ('active', 'trial')
        `, [user.centerID]);

        res.json({ success: true, message: 'Subscription cancelled' });
    } catch (error) {
        console.error('Cancel Error:', error);
        res.status(500).json({ error: 'Cancel failed' });
    }
});

module.exports = router;
