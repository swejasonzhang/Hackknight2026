import { describe, expect, it } from 'vitest'
import { parseCommand } from './commands'

describe('parseCommand', () => {
  it.each([
    ['start', 'start'],
    ["let's go", 'start'],
    ['ready', 'start'],
    ['pause', 'pause'],
    ['hold on', 'pause'],
    ['wait', 'pause'],
    ['resume', 'resume'],
    ['keep going', 'resume'],
    ['continue', 'resume'],
    ['skip', 'skip'],
    ['next set', 'skip'],
    ['move on', 'skip'],
    ['rest', 'rest'],
    ['take a break', 'rest'],
    ['stop', 'stop'],
    ["I'm done", 'stop'],
    ['finish', 'stop'],
    ['end session', 'stop'],
    ['how many', 'status'],
    ['how am I doing', 'status'],
    ['repeat that', 'repeat'],
    ['say that again', 'repeat'],
  ] as const)('hears "%s" as %s', (said, command) => {
    expect(parseCommand(said)).toBe(command)
  })

  it('takes a longer sentence when it is addressed to Arc', () => {
    expect(parseCommand('Arc can we please pause for a moment')).toBe('pause')
    expect(parseCommand('okay arc next set please')).toBe('skip')
  })

  it('ignores ordinary talk, negations and empty speech', () => {
    expect(parseCommand('I think my elbow feels good today honestly')).toBeNull()
    expect(parseCommand("don't stop")).toBeNull()
    expect(parseCommand('do not pause')).toBeNull()
    expect(parseCommand('')).toBeNull()
    expect(parseCommand('banana')).toBeNull()
  })

  it('lets stop win when a phrase holds more than one command', () => {
    expect(parseCommand('stop and rest')).toBe('stop')
  })
})
