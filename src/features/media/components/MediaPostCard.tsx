import ArrowBackIosNew from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIos from '@mui/icons-material/ArrowForwardIos';
import Launch from '@mui/icons-material/Launch';
import Tag from '@mui/icons-material/Tag';
import { Avatar, Card, CardContent, Chip, IconButton, Stack, Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { useState } from 'react';

import { formatMexicoCityDateTime } from '@/lib/dates';

import type { Post, PostSource } from '../model/schemas';

const MediaFrame = styled('div')(({ theme }) => ({
  position: 'relative',
  display: 'grid',
  placeItems: 'center',
  overflow: 'hidden',
  backgroundColor: theme.palette.background.default,
}));

const Content = styled(CardContent)(({ theme }) => ({
  padding: theme.spacing(3),
}));
const PostCardRoot = styled(Card)({ overflow: 'hidden' });
const PostHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: theme.spacing(2),
}));

const Image = styled('img')({
  display: 'block',
  width: '100%',
  maxHeight: 480,
  aspectRatio: '4 / 3',
  objectFit: 'cover',
});

const Video = styled('video')({
  display: 'block',
  width: '100%',
  maxHeight: 480,
  aspectRatio: '4 / 3',
  objectFit: 'contain',
});

const CarouselButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  color: theme.palette.getContrastText(theme.palette.brand.navy),
  backgroundColor: theme.palette.brand.navy,
  '&:hover': { backgroundColor: theme.palette.brand.navy },
}));

const PreviousButton = styled(CarouselButton)(({ theme }) => ({
  left: theme.spacing(1),
}));
const NextButton = styled(CarouselButton)(({ theme }) => ({
  right: theme.spacing(1),
}));

const PositionChip = styled(Chip)(({ theme }) => ({
  position: 'absolute',
  right: theme.spacing(1.5),
  bottom: theme.spacing(1.5),
  color: theme.palette.getContrastText(theme.palette.brand.navy),
  backgroundColor: theme.palette.brand.navy,
}));

const Author = styled(Stack)(({ theme }) => ({
  alignItems: 'center',
  flexDirection: 'row',
  gap: theme.spacing(1.5),
  minWidth: 0,
}));

const AuthorDetails = styled('div')({ minWidth: 0, overflowWrap: 'anywhere' });
const AuthorName = styled(Typography)(({ theme }) => ({
  fontWeight: theme.typography.fontWeightBold,
}));
const AuthorLink = styled('a')(({ theme }) => ({
  ...theme.typography.body1,
  color: theme.palette.text.primary,
  fontWeight: theme.typography.fontWeightBold,
  textDecoration: 'none',
  '&:hover': { textDecoration: 'underline' },
}));
const PostTitle = styled('h3')(({ theme }) => ({
  ...theme.typography.h6,
  marginTop: theme.spacing(2.5),
  marginBottom: 0,
}));
const PostBody = styled(Typography)(({ theme }) => ({
  marginTop: theme.spacing(2.5),
  lineHeight: 1.65,
}));
const PostBodyAfterTitle = styled(PostBody)(({ theme }) => ({
  marginTop: theme.spacing(1),
}));
const TagList = styled(Stack)(({ theme }) => ({
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
  marginTop: theme.spacing(2),
}));

const OriginalLink = styled('a')(({ theme }) => ({
  ...theme.typography.button,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  width: '100%',
  minHeight: theme.spacing(5.25),
  marginTop: theme.spacing(1),
  padding: theme.spacing(1, 2),
  border: `1px solid ${theme.palette.primary.main}`,
  borderRadius: 999,
  color: theme.palette.primary.main,
  overflowWrap: 'anywhere',
  textDecoration: 'none',
  '&:hover': { backgroundColor: theme.palette.action.hover },
}));

const sourceLabels: Record<PostSource, string> = {
  x: 'X',
  instagram: 'Instagram',
  facebook: 'Facebook',
  youtube: 'YouTube',
  linkedin: 'LinkedIn',
};

export const MediaPostCard = ({ post }: { post: Post }) => {
  const [assetIndex, setAssetIndex] = useState(0);
  const [failedImage, setFailedImage] = useState<string>();
  const [failedAvatar, setFailedAvatar] = useState(false);
  const asset = post.media.at(assetIndex);
  const authorName = post.author.displayName ?? `@${post.author.username}`;
  // An empty `alt` means the description is unavailable, not that the media is decorative.
  const assetLabel =
    asset?.alt === ''
      ? `${asset.type === 'image' ? 'Imagen' : 'Video'} de ${authorName} sin descripción disponible`
      : asset?.alt;

  return (
    <PostCardRoot role="article">
      {asset !== undefined && (
        <MediaFrame>
          {asset.type === 'image' ? (
            failedImage === asset.url ? (
              <Typography role="status" color="text.secondary">
                No se pudo cargar la imagen. Consulta la publicación original para ver el recurso.
              </Typography>
            ) : (
              <Image
                src={asset.url}
                alt={assetLabel}
                onError={() => {
                  setFailedImage(asset.url);
                }}
              />
            )
          ) : (
            <Video controls preload="metadata" aria-label={assetLabel}>
              <source src={asset.url} />
              Tu navegador no puede reproducir este video. Consulta la publicación original.
            </Video>
          )}
          {post.media.length > 1 && (
            <>
              <PreviousButton
                aria-label={`Recurso anterior, ${String(assetIndex + 1)} de ${String(post.media.length)}`}
                onClick={() => {
                  setAssetIndex((current) => (current - 1 + post.media.length) % post.media.length);
                }}
              >
                <ArrowBackIosNew fontSize="small" />
              </PreviousButton>
              <NextButton
                aria-label={`Recurso siguiente, ${String(assetIndex + 1)} de ${String(post.media.length)}`}
                onClick={() => {
                  setAssetIndex((current) => (current + 1) % post.media.length);
                }}
              >
                <ArrowForwardIos fontSize="small" />
              </NextButton>
              <PositionChip
                aria-live="polite"
                label={`${String(assetIndex + 1)} / ${String(post.media.length)}`}
                size="small"
              />
            </>
          )}
        </MediaFrame>
      )}
      <Content>
        <PostHeader>
          <Author>
            <Avatar
              src={failedAvatar ? undefined : post.author.avatarUrl}
              alt=""
              onError={() => {
                setFailedAvatar(true);
              }}
            >
              {post.author.displayName?.[0] ?? post.author.username[0]}
            </Avatar>
            <AuthorDetails>
              {post.author.profileUrl !== undefined ? (
                <AuthorLink href={post.author.profileUrl} target="_blank" rel="noreferrer">
                  {authorName}
                </AuthorLink>
              ) : (
                <AuthorName>{authorName}</AuthorName>
              )}
              <Typography color="text.secondary" variant="caption" component="p">
                @{post.author.username} · {formatMexicoCityDateTime(post.postedAt)}
              </Typography>
            </AuthorDetails>
          </Author>
          <Chip label={sourceLabels[post.source]} size="small" variant="outlined" />
        </PostHeader>
        {post.title !== undefined && <PostTitle>{post.title}</PostTitle>}
        {post.body.trim().length > 0 &&
          (post.title === undefined ? (
            <PostBody>{post.body}</PostBody>
          ) : (
            <PostBodyAfterTitle>{post.body}</PostBodyAfterTitle>
          ))}
        {post.tags.length > 0 && (
          <TagList aria-label="Etiquetas">
            {post.tags.map((tag) => (
              <Chip
                key={tag}
                icon={<Tag />}
                label={tag}
                size="small"
                color="primary"
                variant="outlined"
              />
            ))}
          </TagList>
        )}
        <OriginalLink href={post.permalink} target="_blank" rel="noreferrer">
          Ver publicación original <Launch fontSize="small" />
        </OriginalLink>
      </Content>
    </PostCardRoot>
  );
};
