<script setup lang="ts">
import { ref, onMounted } from 'vue';
import BaseButton from '../ui/BaseButton.vue';
import { accessControlService } from '../../services/accessControlService';
import { ShieldCheck, AlertCircle } from 'lucide-vue-next';

const emit = defineEmits(['cancel', 'success']);

const questions = ref<string[]>([]);
const answers = ref<string[]>([]);
const newPassword = ref('');
const error = ref('');
const loading = ref(false);
const step = ref(1); // 1: Questions, 2: Reset Password

onMounted(async () => {
    try {
        questions.value = await accessControlService.getRecoveryQuestions();
        answers.value = new Array(questions.value.length).fill('');
        
        if (questions.value.length === 0) {
            error.value = 'No recovery questions set up. Cannot proceed.';
        }
    } catch (e) {
        error.value = 'Failed to load recovery options.';
    }
});

const handleVerify = async () => {
    // Check if answers are filled
    if (answers.value.some(a => !a.trim())) {
        error.value = 'Please answer all questions.';
        return;
    }
    
    loading.value = true;
    error.value = '';
    
    try {
        const isValid = await accessControlService.verifyRecovery(answers.value);
        if (isValid) {
            step.value = 2; // Move to reset
        } else {
            error.value = 'Incorrect answers.';
        }
    } catch (e) {
        error.value = 'Verification failed.';
    } finally {
        loading.value = false;
    }
};

const handleReset = async () => {
    if (!newPassword.value || newPassword.value.length < 4) {
        error.value = 'Password must be at least 4 characters';
        return;
    }
    
    loading.value = true;
    try {
        await accessControlService.setAdminPassword(newPassword.value);
        emit('success');
    } catch (e) {
        error.value = 'Failed to reset password.';
    } finally {
        loading.value = false;
    }
};
</script>

<template>
    <div class="recovery-container">
        <div class="recovery-card">
            <div class="icon-circle">
                <ShieldCheck class="w-8 h-8 text-primary" />
            </div>
            
            <h2 class="title">Account Recovery</h2>
            
            <div v-if="error" class="error-banner">
                <AlertCircle class="w-4 h-4" />
                <span>{{ error }}</span>
            </div>

            <!-- STEP 1: Questions -->
            <div v-if="step === 1 && questions.length > 0">
                <p class="subtitle">Answer your security questions to reset the Admin password.</p>
                
                <div v-for="(q, idx) in questions" :key="idx" class="form-group">
                    <label class="q-label">{{ q }}</label>
                    <input 
                        type="text" 
                        v-model="answers[idx]" 
                        class="base-input" 
                        placeholder="Your Answer"
                    >
                </div>

                <div class="actions">
                    <BaseButton variant="secondary" @click="$emit('cancel')">Cancel</BaseButton>
                    <BaseButton variant="primary" :loading="loading" @click="handleVerify">Verify Answers</BaseButton>
                </div>
            </div>

            <!-- STEP 2: Reset -->
            <div v-else-if="step === 2">
                <p class="subtitle">Identity Verified. Set a new Admin Password.</p>
                
                <div class="form-group">
                    <label>New Admin Password</label>
                    <input 
                        type="password" 
                        v-model="newPassword" 
                        class="base-input" 
                        placeholder="New Password"
                        autofocus
                    >
                </div>

                <div class="actions">
                    <BaseButton variant="secondary" @click="$emit('cancel')">Cancel</BaseButton>
                    <BaseButton variant="primary" :loading="loading" @click="handleReset">Reset Password</BaseButton>
                </div>
            </div>
            
            <!-- Error State -->
            <div v-else-if="questions.length === 0 && !loading" class="no-options">
                <p>Recovery is not configured. Please contact support or perform a hard reset.</p>
                <BaseButton variant="secondary" @click="$emit('cancel')">Close</BaseButton>
            </div>
        </div>
    </div>
</template>

<style scoped>
.recovery-container {
    padding: 1rem;
    width: 100%;
    animation: fadeIn 0.3s ease-out;
}

.recovery-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 2rem;
    text-align: left;
    box-shadow: var(--shadow-xl); /* Popout effect */
}

/* Same styles as AccessLock for consistency */
.icon-circle {
    width: 56px;
    height: 56px;
    background: var(--color-bg-subtle);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 1.5rem;
}

.title {
    font-size: 1.25rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
    color: var(--color-text-primary);
    text-align: center;
}

.subtitle {
    color: var(--color-text-secondary);
    font-size: 0.9rem;
    margin-bottom: 1.5rem;
    text-align: center;
}

.error-banner {
    background: #FEF2F2;
    color: #991B1B;
    padding: 0.75rem;
    border-radius: var(--radius-md);
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9rem;
}

.form-group {
    margin-bottom: 1.25rem;
}

.q-label {
    display: block;
    font-weight: 500;
    margin-bottom: 0.5rem;
    color: var(--color-text-primary);
    font-size: 0.95rem;
}

.base-input {
    width: 100%;
    padding: 0.6rem 0.8rem;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
    background: var(--color-bg);
    color: var(--color-text-primary);
}

.actions {
    display: flex;
    justify-content: end;
    gap: 1rem;
    margin-top: 1.5rem;
}

@keyframes fadeIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
}
</style>
