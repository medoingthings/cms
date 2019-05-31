<?php
namespace craft\gql\interfaces\elements;

use craft\elements\Entry as EntryElement;
use craft\gql\TypeLoader;
use craft\gql\GqlEntityRegistry;
use craft\gql\types\DateTime;
use craft\gql\types\generators\EntryType;
use GraphQL\Type\Definition\InterfaceType;
use GraphQL\Type\Definition\Type;

/**
 * Class Entry
 */
class Entry extends BaseElement
{
    /**
     * @inheritdoc
     */
    public static function getType($fields = null): Type
    {
        if ($type = GqlEntityRegistry::getEntity(self::class)) {
            return $type;
        }

        $type = GqlEntityRegistry::createEntity(self::class, new InterfaceType([
            'name' => static::getName(),
            'fields' => self::class . '::getFields',
            'resolveType' => function (EntryElement $value) {
                return GqlEntityRegistry::getEntity(EntryType::getName($value->getType()));
            }
        ]));

        foreach (EntryType::generateTypes() as $typeName => $generatedType) {
            TypeLoader::registerType($typeName, function () use ($generatedType) { return $generatedType ;});
        }

        return $type;
    }

    /**
     * @inheritdoc
     */
    public static function getName(): string
    {
        return 'EntryInterface';
    }

    /**
     * @inheritdoc
     */
    public static function getFields(): array {
        // Todo section data under section type, same with type, author, revisionCreator
        return array_merge(parent::getCommonFields(), [
            'sectionUid' => Type::string(),
            'sectionId' => Type::int(),
            'sectionHandle' => Type::string(),
            'typeUid' => Type::string(),
            'typeId' => Type::int(),
            'typeHandle' => Type::string(),
            'authorId' => Type::int(),
            'author' => [
                'name' => 'author',
                'type' => User::getType(),
            ],
            'postDate' => DateTime::getType(),
            'expiryDate' => DateTime::getType(),
            'revisionCreatorId' => Type::int(),
            'revisionNotes' => Type::string(),
        ]);
    }
}