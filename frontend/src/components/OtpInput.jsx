import { useRef } from 'react'

// Six separate digit boxes. Typing moves forward, backspace on an empty box moves back,
// and pasting a code fills every box at once.
function OtpInput({ digits, onChange }) {
  const inputs = useRef([])

  function setDigit(index, value) {
    const next = [...digits]
    next[index] = value
    onChange(next)
  }

  function handleChange(index, event) {
    const digit = event.target.value.replace(/\D/g, '').slice(-1)
    setDigit(index, digit)
    if (digit && index < digits.length - 1) {
      inputs.current[index + 1].focus()
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !digits[index] && index > 0) {
      event.preventDefault()
      setDigit(index - 1, '')
      inputs.current[index - 1].focus()
    }
  }

  function handlePaste(event) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, digits.length)
    if (!pasted) return
    event.preventDefault()
    onChange(digits.map((_, index) => pasted[index] || ''))
    inputs.current[Math.min(pasted.length, digits.length - 1)].focus()
  }

  return (
    <div className="flex justify-center gap-2 sm:gap-3" onPaste={handlePaste}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => (inputs.current[index] = element)}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onFocus={(event) => event.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1}`}
          className="h-14 w-12 rounded-2xl border border-primary/25 bg-white text-center text-2xl font-bold text-primary-dark outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 sm:h-16 sm:w-14"
        />
      ))}
    </div>
  )
}

export default OtpInput
