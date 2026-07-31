import { LegalLayout } from '../components/legal/LegalLayout'
import { RichText } from '../components/legal/RichText'
import { useT } from '../i18n'

export function Terms() {
  const { terms } = useT().legal
  return (
    <LegalLayout title={terms.title} updated={terms.updated}>
      <RichText blocks={terms.blocks} />
    </LegalLayout>
  )
}
