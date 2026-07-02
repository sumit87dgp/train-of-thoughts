import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  createThought as createThoughtApi,
  deleteThought as deleteThoughtApi,
  updateThought as updateThoughtApi,
} from '../api/client.js'

function getErrorMessage(error) {
  return error instanceof Error ? error.message : 'Request failed'
}

export function useThoughtMutations() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  const invalidateAfterChange = useCallback(
    (id) => {
      queryClient.invalidateQueries({ queryKey: ['thoughts'] })
      queryClient.invalidateQueries({ queryKey: ['tags'] })
      if (id) {
        queryClient.invalidateQueries({ queryKey: ['thought', id] })
      }
    },
    [queryClient],
  )

  const createMutation = useMutation({
    mutationFn: createThoughtApi,
    onSuccess: (thought) => {
      invalidateAfterChange(thought.id)
      navigate(`/thoughts/${thought.id}`, { replace: true })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, body }) => updateThoughtApi(id, body),
    onSuccess: (thought) => {
      invalidateAfterChange(thought.id)
      navigate(`/thoughts/${thought.id}`, { replace: true })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteThoughtApi,
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: ['thought', id] })
      invalidateAfterChange(id)
      navigate('/', { replace: true })
    },
  })

  const createThought = useCallback(
    (body) => {
      createMutation.reset()
      createMutation.mutate(body)
    },
    [createMutation],
  )

  const updateThought = useCallback(
    (id, body) => {
      updateMutation.reset()
      updateMutation.mutate({ id, body })
    },
    [updateMutation],
  )

  const deleteThought = useCallback(
    (id) => {
      deleteMutation.mutate(id)
    },
    [deleteMutation],
  )

  return {
    createThought,
    updateThought,
    deleteThought,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    createError: createMutation.error
      ? getErrorMessage(createMutation.error)
      : null,
    updateError: updateMutation.error
      ? getErrorMessage(updateMutation.error)
      : null,
    deleteError: deleteMutation.error
      ? getErrorMessage(deleteMutation.error)
      : null,
  }
}
