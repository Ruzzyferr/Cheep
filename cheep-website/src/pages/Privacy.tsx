import { LegalLayout } from '../components/legal/LegalLayout'
import { RichText } from '../components/legal/RichText'
import { useT } from '../i18n'

export function Privacy() {
  const { privacy } = useT().legal
  return (
    <LegalLayout title={privacy.title} updated={privacy.updated}>
      <RichText blocks={privacy.blocks} />
    </LegalLayout>
  )
}
