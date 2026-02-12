"use client";

type Listener = (count: number) => void;

let activeCount = 0;
const listeners = new Set<Listener>();

function emit() {
	for (const listener of listeners) listener(activeCount);
}

export function beginLoading() {
	activeCount += 1;
	emit();
}

export function endLoading() {
	activeCount = Math.max(0, activeCount - 1);
	emit();
}

export function subscribeLoading(listener: Listener) {
	listeners.add(listener);
	listener(activeCount);
	return () => {
		listeners.delete(listener);
	};
}

export function getLoadingCount() {
	return activeCount;
}
