import { ref, onMounted, onUnmounted, type Ref } from 'vue';
import { liveQuery, type Subscription } from 'dexie';

export function useLiveQuery<T>(
    querier: () => Promise<T> | T
): Ref<T | undefined> {
    const value = ref<T>();
    let subscription: Subscription;

    const start = () => {
        const observable = liveQuery(querier);
        subscription = observable.subscribe({
            next: (val) => { value.value = val; },
            error: (err) => console.error(err)
        });
    };

    onMounted(start);
    onUnmounted(() => {
        if (subscription) subscription.unsubscribe();
    });

    return value;
}
