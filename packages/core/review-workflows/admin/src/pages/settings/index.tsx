/* eslint-disable check-file/no-index */
/* eslint-disable check-file/filename-naming-convention */
import * as React from 'react';

import { Page, useTracking, ConfirmDialog, useRBAC, Table } from '@strapi/admin/strapi-admin';
import { useLicenseLimits } from '@strapi/admin/strapi-admin/ee';
import { Flex, IconButton, TFooter, Typography, VisuallyHidden } from '@strapi/design-system';
import { Link, LinkButton } from '@strapi/design-system/v2';
import { Pencil, Plus, Trash } from '@strapi/icons';
import { useIntl } from 'react-intl';
import { NavLink, useNavigate } from 'react-router-dom';
import styled from 'styled-components';

import { Workflow } from '../../../../shared/contracts/review-workflows';
import { useTypedSelector } from '../../modules/hooks';
import { useGetContentTypesQuery } from '../../services/content-manager';

import * as Layout from './components/Layout';
import { LimitsModal } from './components/LimitsModal';
import { CHARGEBEE_WORKFLOW_ENTITLEMENT_NAME } from './constants';
import { useReviewWorkflows } from './hooks/useReviewWorkflows';

export const ReviewWorkflowsListView = () => {
  const { formatMessage } = useIntl();
  const navigate = useNavigate();
  const { trackUsage } = useTracking();
  const [workflowToDelete, setWorkflowToDelete] = React.useState<string | null>(null);
  const [showLimitModal, setShowLimitModal] = React.useState<boolean>(false);
  const { data = [], isLoading: isLoadingModels } = useGetContentTypesQuery();
  const { meta, workflows, isLoading, delete: deleteAction } = useReviewWorkflows();
  const { getFeature, isLoading: isLicenseLoading } = useLicenseLimits();
  const permissions = useTypedSelector(
    (state) => state.admin_app.permissions.settings?.['review-workflows']
  );
  const {
    allowedActions: { canCreate, canRead, canUpdate, canDelete },
  } = useRBAC(permissions);

  const limits = getFeature('review-workflows');
  const numberOfWorkflows = limits?.[CHARGEBEE_WORKFLOW_ENTITLEMENT_NAME] as string;

  const handleDeleteWorkflow = (workflowId: string) => {
    setWorkflowToDelete(workflowId);
  };

  const toggleConfirmDeleteDialog = () => {
    setWorkflowToDelete(null);
  };

  const handleConfirmDeleteDialog = async () => {
    if (!workflowToDelete) return;

    await deleteAction(workflowToDelete);

    setWorkflowToDelete(null);
  };

  const handleCreateClick = (
    event: React.MouseEvent<HTMLButtonElement> & React.MouseEvent<HTMLAnchorElement>
  ) => {
    event.preventDefault();
    /**
     * If the current license has a workflow limit:
     * check if the total count of workflows exceeds that limit. If so,
     * prevent the navigation and show the limits overlay.
     *
     * If the current license does not have a limit (e.g. offline license):
     * allow the user to navigate to the create-view. In case they exceed the
     * current hard-limit of 200 they will see an error thrown by the API.
     */

    if (numberOfWorkflows && meta && meta?.workflowCount >= parseInt(numberOfWorkflows, 10)) {
      event.preventDefault();
      setShowLimitModal(true);
    } else {
      navigate('create');
      trackUsage('willCreateWorkflow');
    }
  };

  /**
   * If the current license has a limit:
   * check if the total count of workflows or stages exceeds that limit and display
   * the limits modal on page load. It can be closed by the user, but the
   * API will throw an error in case they try to create a new workflow or update the
   * stages.
   *
   * If the current license does not have a limit (e.g. offline license):
   * do nothing (for now). In case they are trying to create the 201st workflow/ stage
   * the API will throw an error.
   *
   */
  React.useEffect(() => {
    if (!isLoading && !isLicenseLoading) {
      if (numberOfWorkflows && meta && meta?.workflowCount > parseInt(numberOfWorkflows, 10)) {
        setShowLimitModal(true);
      }
    }
  }, [isLicenseLoading, isLoading, meta, meta?.workflowCount, numberOfWorkflows]);

  const headers = [
    {
      label: formatMessage({
        id: 'Settings.review-workflows.list.page.list.column.name.title',
        defaultMessage: 'Name',
      }),
      name: 'name',
    },
    {
      label: formatMessage({
        id: 'Settings.review-workflows.list.page.list.column.stages.title',
        defaultMessage: 'Stages',
      }),
      name: 'stages',
    },
    {
      label: formatMessage({
        id: 'Settings.review-workflows.list.page.list.column.contentTypes.title',
        defaultMessage: 'Content Types',
      }),
      name: 'content-types',
    },
  ];

  if (isLoading || isLoadingModels) {
    return <Page.Loading />;
  }

  return (
    <>
      <Layout.Header
        primaryAction={
          canCreate ? (
            <LinkButton
              startIcon={<Plus />}
              size="S"
              as={NavLink}
              // @ts-expect-error – the `as` prop does not correctly infer the props of it's component
              to="create"
              onClick={handleCreateClick}
            >
              {formatMessage({
                id: 'Settings.review-workflows.list.page.create',
                defaultMessage: 'Create new workflow',
              })}
            </LinkButton>
          ) : null
        }
        subtitle={formatMessage({
          id: 'Settings.review-workflows.list.page.subtitle',
          defaultMessage: 'Manage your content review process',
        })}
        title={formatMessage({
          id: 'Settings.review-workflows.list.page.title',
          defaultMessage: 'Review Workflows',
        })}
      />

      <Layout.Root>
        <Table.Root
          isLoading={isLoading}
          rows={workflows}
          footer={
            canCreate ? (
              <TFooter icon={<Plus />} onClick={handleCreateClick}>
                {formatMessage({
                  id: 'Settings.review-workflows.list.page.create',
                  defaultMessage: 'Create new workflow',
                })}
              </TFooter>
            ) : null
          }
          headers={headers}
        >
          <Table.Content>
            <Table.Head>
              {headers.map((head) => (
                <Table.HeaderCell key={head.name} {...head} />
              ))}
            </Table.Head>

            <Table.Body>
              {workflows.map((workflow) => (
                <Table.Row
                  onClick={() => {
                    navigate(`${workflow.id}`);
                  }}
                  key={workflow.id}
                >
                  <Table.Cell width={`${250 / 16}rem`}>
                    <Typography textColor="neutral800" fontWeight="bold" ellipsis>
                      {workflow.name}
                    </Typography>
                  </Table.Cell>
                  <Table.Cell>
                    <Typography textColor="neutral800">{workflow.stages.length}</Typography>
                  </Table.Cell>
                  <Table.Cell>
                    <Typography textColor="neutral800">
                      {workflow.contentTypes
                        .map((uid: string) => {
                          const contentType = data.find((contentType) => contentType.uid === uid);

                          return contentType?.info.displayName ?? '';
                        })
                        .join(', ')}
                    </Typography>
                  </Table.Cell>
                  <Table.Cell>
                    <Flex alignItems="center" justifyContent="end">
                      {canRead || canUpdate ? (
                        <ActionLink
                          // @ts-expect-error – the `as` prop does not correctly infer the props of it's component
                          to={`${workflow.id}`}
                          aria-label={formatMessage(
                            {
                              id: 'Settings.review-workflows.list.page.list.column.actions.edit.label',
                              defaultMessage: 'Edit {name}',
                            },
                            { name: workflow.name }
                          )}
                        >
                          <Pencil />
                        </ActionLink>
                      ) : null}
                      {workflows.length > 1 && canDelete ? (
                        <IconButton
                          aria-label={formatMessage(
                            {
                              id: 'Settings.review-workflows.list.page.list.column.actions.delete.label',
                              defaultMessage: 'Delete {name}',
                            },
                            { name: 'Default workflow' }
                          )}
                          icon={<Trash />}
                          borderWidth={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteWorkflow(String(workflow.id));
                          }}
                        />
                      ) : null}
                    </Flex>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Content>
        </Table.Root>

        <ConfirmDialog
          isOpen={!!workflowToDelete}
          onClose={toggleConfirmDeleteDialog}
          onConfirm={handleConfirmDeleteDialog}
        >
          {formatMessage({
            id: 'Settings.review-workflows.list.page.delete.confirm.body',
            defaultMessage:
              'If you remove this worfklow, all stage-related information will be removed for this content-type. Are you sure you want to remove it?',
          })}
        </ConfirmDialog>

        <LimitsModal.Root isOpen={showLimitModal} onClose={() => setShowLimitModal(false)}>
          <LimitsModal.Title>
            {formatMessage({
              id: 'Settings.review-workflows.list.page.workflows.limit.title',
              defaultMessage: 'You’ve reached the limit of workflows in your plan',
            })}
          </LimitsModal.Title>

          <LimitsModal.Body>
            {formatMessage({
              id: 'Settings.review-workflows.list.page.workflows.limit.body',
              defaultMessage: 'Delete a workflow or contact Sales to enable more workflows.',
            })}
          </LimitsModal.Body>
        </LimitsModal.Root>
      </Layout.Root>
    </>
  );
};

const ActionLink = styled(Link)`
  align-items: center;
  height: ${32 / 16}rem;
  display: flex;
  justify-content: center;
  padding: ${({ theme }) => `${theme.spaces[2]}}`};
  width: ${32 / 16}rem;

  svg {
    height: ${12 / 16}rem;
    width: ${12 / 16}rem;

    path {
      fill: ${({ theme }) => theme.colors.neutral500};
    }
  }

  &:hover,
  &:focus {
    svg {
      path {
        fill: ${({ theme }) => theme.colors.neutral800};
      }
    }
  }
`;

const ProtectedListPage = () => {
  const permissions = useTypedSelector(
    (state) => state.admin_app.permissions.settings?.['review-workflows']?.main
  );

  return (
    <Page.Protect permissions={permissions}>
      <ReviewWorkflowsListView />
    </Page.Protect>
  );
};

export { ProtectedListPage };