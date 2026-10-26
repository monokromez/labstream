import { readCatalog } from '../data/administratorCatalog.js'

const STORAGE_KEY = 'labstream.cashier.transactions.v1'
const CHANGE_EVENT = 'labstream:cashier-transactions-changed'

const makeId = () => globalThis.crypto?.randomUUID?.()
  ?? `txn-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

const todayISO = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

const readTransactions = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored)
      if (Array.isArray(parsed)) return parsed
    }
  } catch {
    return []
  }
  return []
}

const writeTransactions = (transactions) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions))
    window.dispatchEvent(new Event(CHANGE_EVENT))
  } catch {
    // Keep the UI usable if browser storage is unavailable for this session.
  }
  return transactions
}

export const getCashierTransactions = () => readTransactions()

export const subscribeToCashierTransactions = (listener) => {
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', listener)
  }
}

export const createCashierTransaction = ({ patient, testIds }) => {
  const { tests: testCatalog } = readCatalog()
  const tests = testIds.map((id) => testCatalog.find((test) => String(test.id) === String(id))).filter(Boolean)
  if (!patient || tests.length === 0) return null

  const transactions = readTransactions()
  if (transactions.some((transaction) => transaction.pid === patient.pid && transaction.status === 'pending')) return null

  const transaction = {
    id: makeId(),
    pid: patient.pid,
    patientName: [patient.firstName, patient.middleName, patient.lastName].filter(Boolean).join(' ') || patient.name || 'Patient',
    tests: tests.map(({ id, name, category, price }) => ({ id, name, category, price })),
    fee: tests.reduce((total, test) => total + test.price, 0),
    paymentMethod: 'cash',
    status: 'pending',
    requestedAt: new Date().toISOString(),
    transactionDate: null,
    receiptNumber: null,
  }

  writeTransactions([transaction, ...transactions])
  return transaction
}

export const updateCashierTransaction = (transactionId, updates) => {
  const transactions = readTransactions()
  const updated = transactions.map((transaction) => transaction.id === transactionId
    ? { ...transaction, ...updates }
    : transaction)
  writeTransactions(updated)
  return updated.find((transaction) => transaction.id === transactionId) ?? null
}

export const getLocalTransactionDate = todayISO

export const createReceiptNumber = () => {
  const date = todayISO().replaceAll('-', '')
  const suffix = Math.random().toString(10).slice(2, 6).padEnd(4, '0')
  return `LS-${date}-${suffix}`
}
