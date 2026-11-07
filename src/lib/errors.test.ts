import { describe, expect, it } from 'vitest'
import { AuthError, SessionExpiredError } from '../google/types'
import { isAllowedEmail, toUiError } from './errors'

describe('isAllowedEmail', () => {
  it('accepte tout compte quand aucun domaine n’est configuré', () => {
    expect(isAllowedEmail('a@b.com', '')).toBe(true)
  })

  it('n’accepte que le domaine exact', () => {
    expect(isAllowedEmail('Jean@Entreprise.com', 'entreprise.com')).toBe(true)
    expect(isAllowedEmail('jean@fausse-entreprise.com', 'entreprise.com')).toBe(false)
    expect(isAllowedEmail('jean@entreprise.com.pirate.io', 'entreprise.com')).toBe(false)
  })
})

describe('toUiError', () => {
  it('propose de se reconnecter quand la session a expiré', () => {
    expect(toUiError(new SessionExpiredError())).toEqual({ key: 'error.expired', reconnect: true })
  })

  it('explique les autorisations manquantes', () => {
    expect(toUiError(new AuthError('scopes')).key).toBe('error.scopes')
  })
})
