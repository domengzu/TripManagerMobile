<?php

namespace App\Services;

use App\Models\PushToken;
use App\Models\User;
use Kreait\Firebase\Factory;
use Kreait\Firebase\Messaging\CloudMessage;
use Kreait\Firebase\Messaging\Notification;
use Kreait\Firebase\Messaging\AndroidConfig;
use Illuminate\Support\Facades\Log;

/**
 * Push Notification Service using Firebase Cloud Messaging (FCM)
 * 
 * This service handles sending push notifications to mobile devices
 * using Firebase Cloud Messaging API.
 */
class PushNotificationService
{
    protected $messaging;

    public function __construct()
    {
        try {
            $factory = (new Factory)->withServiceAccount(config('services.firebase.credentials'));
            $this->messaging = $factory->createMessaging();
        } catch (\Exception $e) {
            Log::error('Failed to initialize Firebase Messaging: ' . $e->getMessage());
            throw $e;
        }
    }

    /**
     * Send a push notification to a single user
     * 
     * @param User $user The user to send the notification to
     * @param string $title Notification title
     * @param string $body Notification body text
     * @param array $data Additional data payload
     * @return bool Success status
     */
    public function sendToUser(User $user, string $title, string $body, array $data = [])
    {
        $tokens = PushToken::where('user_id', $user->id)->pluck('token')->toArray();

        if (empty($tokens)) {
            Log::info("No push tokens found for user {$user->id}");
            return false;
        }

        return $this->sendPushNotifications($tokens, $title, $body, $data);
    }

    /**
     * Send push notifications to multiple users
     * 
     * @param array $userIds Array of user IDs
     * @param string $title Notification title
     * @param string $body Notification body text
     * @param array $data Additional data payload
     * @return bool Success status
     */
    public function sendToMultipleUsers(array $userIds, string $title, string $body, array $data = [])
    {
        $tokens = PushToken::whereIn('user_id', $userIds)->pluck('token')->toArray();

        if (empty($tokens)) {
            Log::info("No push tokens found for provided users");
            return false;
        }

        return $this->sendPushNotifications($tokens, $title, $body, $data);
    }

    /**
     * Send push notifications using Firebase Cloud Messaging
     * 
     * @param array $tokens FCM device tokens
     * @param string $title Notification title
     * @param string $body Notification body text
     * @param array $data Additional data payload
     * @return bool Success status
     */
    private function sendPushNotifications(array $tokens, string $title, string $body, array $data = [])
    {
        try {
            // Create notification
            $notification = Notification::create($title, $body);

            // Configure Android-specific settings for heads-up notifications
            $androidConfig = AndroidConfig::fromArray([
                'priority' => 'high',
                'notification' => [
                    'channel_id' => 'default',
                    'sound' => 'default',
                    'priority' => 'max',
                    'visibility' => 'public',
                ],
            ]);

            // Build the message
            $message = CloudMessage::new()
                ->withNotification($notification)
                ->withData($data)
                ->withAndroidConfig($androidConfig);

            // Send to multiple devices
            $sendReport = $this->messaging->sendMulticast($message, $tokens);

            // Log results
            Log::info('FCM notifications sent', [
                'success_count' => $sendReport->successes()->count(),
                'failure_count' => $sendReport->failures()->count(),
                'total_tokens' => count($tokens),
            ]);

            // Handle failed tokens
            if ($sendReport->hasFailures()) {
                foreach ($sendReport->failures()->getItems() as $failure) {
                    $failedToken = $failure->target()->value();
                    $errorMessage = $failure->error()->getMessage();
                    
                    Log::warning('FCM token failed', [
                        'token' => substr($failedToken, 0, 20) . '...', // Log partial token for security
                        'error' => $errorMessage,
                    ]);

                    // Remove invalid tokens from database
                    if ($this->isUnrecoverableError($errorMessage)) {
                        PushToken::where('token', $failedToken)->delete();
                        Log::info('Removed invalid FCM token from database');
                    }
                }
            }

            return $sendReport->successes()->count() > 0;
        } catch (\Exception $e) {
            Log::error('FCM send error: ' . $e->getMessage(), [
                'exception' => get_class($e),
                'trace' => $e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * Check if error is unrecoverable and token should be removed
     * 
     * @param string $errorMessage The error message from FCM
     * @return bool True if token should be removed
     */
    private function isUnrecoverableError(string $errorMessage): bool
    {
        $unrecoverableErrors = [
            'NotRegistered',
            'InvalidRegistration',
            'MismatchSenderId',
        ];

        foreach ($unrecoverableErrors as $error) {
            if (stripos($errorMessage, $error) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Send a notification about a new trip ticket assignment
     * 
     * @param User $driver The driver being assigned
     * @param int $tripTicketId The trip ticket ID
     * @param string $passengerName The passenger name
     * @return bool Success status
     */
    public function sendTripAssignmentNotification(User $driver, int $tripTicketId, string $passengerName)
    {
        $title = 'New Trip Assignment';
        $body = "New trip ticket has been created for {$passengerName}";
        $data = [
            'type' => 'trip_ticket_assigned',
            'trip_ticket_id' => (string)$tripTicketId,
        ];

        return $this->sendToUser($driver, $title, $body, $data);
    }

    /**
     * Send a notification about trip ticket approval
     * 
     * @param User $driver The driver
     * @param int $tripTicketId The trip ticket ID
     * @param string $ticketNumber The ticket number
     * @param string $passengerName The passenger name
     * @return bool Success status
     */
    public function sendTripApprovalNotification(User $driver, int $tripTicketId, string $ticketNumber, string $passengerName)
    {
        $title = 'Trip Ticket Approved';
        $body = "Your trip ticket #{$ticketNumber} for {$passengerName}'s trip has been approved by procurement";
        $data = [
            'type' => 'trip_ticket_approved',
            'trip_ticket_id' => (string)$tripTicketId,
            'ticket_number' => $ticketNumber,
        ];

        return $this->sendToUser($driver, $title, $body, $data);
    }

    /**
     * Send a notification about trip ticket rejection
     * 
     * @param User $driver The driver
     * @param int $tripTicketId The trip ticket ID
     * @param string $ticketNumber The ticket number
     * @param string $reason The rejection reason
     * @return bool Success status
     */
    public function sendTripRejectionNotification(User $driver, int $tripTicketId, string $ticketNumber, string $reason)
    {
        $title = 'Trip Ticket Rejected';
        $body = "Your trip ticket #{$ticketNumber} has been rejected: {$reason}";
        $data = [
            'type' => 'trip_ticket_rejected',
            'trip_ticket_id' => (string)$tripTicketId,
            'ticket_number' => $ticketNumber,
        ];

        return $this->sendToUser($driver, $title, $body, $data);
    }
}
