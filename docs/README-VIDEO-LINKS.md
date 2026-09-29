# Maintain this installation's mission videos

The framework starts with an empty [video configuration map](../content/ksda/topic-video-links.json). Its [optional example register](../examples/capai-community-reading/VIDEO-LINKS.md) has **28 intentionally blank future URL cells**, one for each example mission. Those cells remain blank until the operator supplies reviewed links.

This is the independent framework. The original CAPAi recovery snapshot retains its working `fire-m01` video and 27 pending placeholders unchanged. No CAPAi-owned video is an operational framework default.

## Editable configuration

The JSON map uses the site's course slug as its first key and the exact, case-sensitive mission ID as its second key. For example, the following shows the format only; the URL is a placeholder, not an installed video:

```json
{
  "fire-life-safety": {
    "fire-m01": "https://your-video-provider.example/reviewed-mission-video"
  }
}
```

Keep the actual map `{}` while no independent links are ready. Use the stable identifiers in [module authoring](MODULES.md) and the [28-slot register](../examples/capai-community-reading/VIDEO-LINKS.md). Missing entries preserve the existing reading-first placeholder. Do not insert empty strings or invented URLs merely to populate the register.

Configured links must use HTTPS without embedded usernames/passwords or custom ports. Full Canva design `watch` or `view` URLs can use the validated inline viewer; Canva short links and other valid HTTPS URLs open externally in a new tab. Arbitrary URLs and pasted iframe HTML are never converted into embeds. No autoplay or watch-completion tracking is added. A video remains optional and does not gate reading, reflections or course completion.

The per-mission JSON map controls the current lesson video position. The optional reading payload's signed `video_link` and `video_embed` fields are empty in this framework example. Do not edit an installed signed payload in place to change a link.

## After receiving an approved link

1. Confirm that the installation has permission to use the video, that it matches the correct mission, and that its playback and captions have been reviewed.
2. Update the relevant nested JSON entry and the matching register cell. Preserve other mission IDs, links and empty positions.
3. Run `npm run content:validate`. Video configuration is included in the runtime code identity, so regenerate that identity with `node scripts/generate-reading-code-identity.mjs`.
4. When reading delivery is active, prepare a successor content/delivery release bound to the new code hash. Preserve the installed release and its history. Follow [the example's versioning instructions](../examples/capai-community-reading/README.md), [module versioning](MODULES.md) and [reading installation](READING-INSTALL.md).
5. Validate the package, build and test the application, then review and explicitly activate matching content only in the installation's own backend. A configuration edit, generated hash or GitHub upload does not deploy an application or approve publication.

Do not point a white-label installation at CAPAi production or reuse CAPAi's approval/code hash for changed bytes. The server flag `KSDA_READING_DELIVERY_ENABLED` remains `false` until independently reviewed content has been installed, approved and activated; `brand.features.readingCompanions` is the corresponding public feature switch. See [environment setup](../.env.example) and [database setup](DATABASE.md).
